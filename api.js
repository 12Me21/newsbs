
// *************
// ---- API ----
// *************

function Api(root, signalHandler)
{
   this.root = root;
   this.signal = signalHandler || ((n,d) => console.log("Ignoring signal " + name));
   this.nextrequestid = 0;
   this.getToken = (() => null);
}

Api.prototype.FormatData = function(data)
{
   var base = "[" + data.rid + "] " + data.endpoint + ": " + 
      data.request.status + " " + data.request.statusText;
   return base;
};

Api.prototype.Generic = function(suburl, success, error, always, method, data, modify)
{
   var me = this;

   let thisreqid = ++me.nextrequestid;
   var endpoint = suburl;
   var epquery = endpoint.indexOf("?");

   if(epquery >= 0) 
      endpoint = endpoint.substr(0, epquery);

   url = me.root + "/" + suburl;
   method = method || "GET";

   var req = new XMLHttpRequest();

   var apidat = { rid: thisreqid, url: url, endpoint: endpoint, method : method, request : req,
      senddata : data };

   //This is supposedly thrown before the others
   req.addEventListener("error", function() 
   {
      apidat.networkError = true; 
      me.signal("apinetworkerror", apidat);
   });
   req.addEventListener("loadend", function()
   {
      if(always) 
         always(apidat);

      if(req.status <= 299 && req.status >= 200)
      {
         apidat.data = req.responseText ? JSON.parse(req.responseText) : null;

         if(success)
            success(apidat);

         me.signal("apisuccess", apidat);
      }
      else
      {
         //Also thrown on network error
         if(error)
            error(apidat);

         me.signal("apierror", apidat);
      }

      me.signal("apiend", apidat);
   });

   req.open(method, url);
   req.setRequestHeader("accept", "application/json");
   req.setRequestHeader("Content-Type", "application/json");
   //These are from 12me
   req.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate")
   req.setRequestHeader('Pragma', "no-cache") // for internet explorer

   var token = me.getToken();
   if(token)
      req.setRequestHeader("Authorization", "Bearer " + token);

   if(modify)
      modify(apidat);

   me.signal("apistart", apidat);

   if(data)
      req.send(JSON.stringify(data));
   else
      req.send();
};

Api.prototype.Get = function(endpoint, params, success, error, always, modify)
{
   params = params || "";
   if(typeof params !== "string")
      params = params.toString();

   this.Generic(endpoint + "?" + params, success, error, always, "GET", null, modify);
};

Api.prototype.Post = function(endpoint, data, success, error, always, modify)
{
   this.Generic(endpoint, success, error, always, "POST", data, modify);
};

Api.prototype.Put = function(endpoint, data, success, error, always, modify)
{
   this.Generic(endpoint, success, error, always, "Put", data, modify);
};

Api.prototype.Delete = function(endpoint, id, success, error, always, modify)
{
   this.Generic(endpoint + "/" + id, success, error, always, "DELETE", null, modify);
};

Api.prototype.AutoLink = function(data) 
{
   if(!data)
      return;

   var users = data.user;
   var content = data.content;

   //Chain does something special and pre-links some data together for you
   if(content)
   {
      DataFormat.LinkField(content, "createUserId", "createUser", users);
      DataFormat.LinkField(content, "editUserId", "editUser", users);

      content.forEach(x =>
      {
         if(x.type == "userpage" && x.createUser)
            x.name = x.createUser.username + "'s user page";
      });
   }
};

Api.prototype.Chain = function(params, success, error, always, modify)
{
   var me = this;
   this.Get("read/chain", params, apidat =>
   {
      me.AutoLink(apidat.data);
      success(apidat);
   }, error, always, modify);
};

Api.prototype.Listen = function(params, success, error, always, modify)
{
   var me = this;
   this.Get("read/listen", params, apidat =>
   {
      if(apidat.data)
         me.AutoLink(apidat.data.chains);
      success(apidat);
   }, error, always, modify);
};

Api.prototype.WatchClear = function(cid, success, error, always, modify)
{
   this.Post("watch/" + cid + "/clear", {}, success, error, always, modify);
};

Api.prototype.SearchSort = function(list, search, fieldGet, multiplier)
{
   if(list)
   {
      search = search.toLowerCase();
      var test = new RegExp("\\b" + search + "\\b", "i");
      multiplier = multiplier || 1;

      list.forEach(x =>
      {
         x.searchscore = x.searchscore || 0;
         var val = fieldGet(x).toLowerCase();
         x.searchscore += multiplier * ((val.startsWith(search) ? 3 : 0) + 
            (val.endsWith(search) ? 2 : 0) + 
            (test.test(val) ? 1 : 0));
      });

      //Reverse score order, highest first (y-x)
      list.sort((x,y) => Math.sign(y.searchscore - x.searchscore));
   }
};

//searchops = { sort : "id/createDate/editDate", reverse : true, 
//    value: "searchthis", search : { pages : true, users : true, categories : true} }
Api.prototype.Search = function(searchops, success, error, always, modify)
{
   var me = this;

   var search = { 
      sort: searchops.sort,
      reverse: searchops.reverse
   };
   var keysearch = Utilities.ShallowCopy(search);

   var like = "%" + searchops.value + "%";
   search.namelike = like;
   search.usernamelike = like;
   keysearch.keyword = like;

   var params = new URLSearchParams();

   //There HAS to be at least one search, so "search" sub-object better exist
   if(searchops.search.pages)
   {
      params.append("requests", "content-" + JSON.stringify(search));
      params.append("requests", "content-" + JSON.stringify(keysearch));
   }
   if(searchops.search.users) //searchusersoption.checked)
   {
      params.append("requests", "user-" + JSON.stringify(search));
   }
   if(searchops.search.categories) //searchcategoriesoption.checked)
   {
      params.append("requests", "category-" + JSON.stringify(search));
   }
   params.set("content","id,name,type,createUserId,keywords,createDate,editDate,values,permissions");

   globals.api.Chain(params, data =>
   {
      //First, get rid of content that's a userpage, nobody wants that (for now?)
      if(data.data.content)
         data.data.content = data.data.content.filter(x => x.type != "userpage");

      //Modify the order for data so the ones that start or end with or have
      //the search result all by itself come first.
      this.SearchSort(data.data.content, searchops.value, x => x.name);
      this.SearchSort(data.data.content, searchops.value, x => x.keywords.join(" "), 0.5);
      this.SearchSort(data.data.user, searchops.value, x => x.username);
      this.SearchSort(data.data.category, searchops.value, x => x.name);
      success(data); 
   }, error, always, modify);
}

// **********************
// ---- LONG POLLING ----
// **********************

function LongPoller(api, signalHandler, log)
{
   this.api = api;
   this.signal = signalHandler || ((n,d) => console.log("Ignoring signal " + name));
   this.log = log || ((msg, msg2, msg3) => console.log(msg, msg2, msg3));
   this.pending = [];
   this.errortime = 5000;
   this.ratetimeout = 1500;
   this.recallrids = [];
   this.instantComplete = false;
}

function LongPollData(lastId, statuses, lastListeners)
{
   this.statuses = statuses;
   this.lastId = lastId;
   this.lastListeners = lastListeners;
}

LongPoller.prototype.TryAbortAll = function()
{
   var count = 0;
   var me = this;
   this.pending.forEach(x =>
   {
      me.log("Aborting old long poller [" + x.rid + "]...");
      x.abortNow = true;
      x.request.abort();
      count++;
   });
   return count;
};

LongPoller.prototype.Update = function (lastId, statuses)
{
   this.log("Updating long poller, restarting with " + this.pending.length + " pending");

   //Just always abort, if they want an update, they'll GET one
   this.TryAbortAll();

   var emptyLastListeners = {};

   for(key in statuses)
      emptyLastListeners[key] = { "0" : "" };

   this.Repeater(new LongPollData(lastId, statuses, emptyLastListeners));
};

LongPoller.prototype.Repeater = function(lpdata)
{
   var me = this;

   me.signal("longpollstart", lpdata);

   var clearNotifications = Object.keys(lpdata.statuses).map(x => Number(x)).filter(x => x > 0);

   var recall = (apidat) => 
   {
      if(!me.recallrids.some(x => x === apidat.rid))
      {
         if(!apidat.abortNow)
         {
            me.recallrids.push(apidat.rid);
            me.Repeater(lpdata);
         }
         else
         {
            me.log("Tried to repeat from aborted long poller");
         }
      }
      else
      {
         me.log("Tried to repeat long poller multiple times");
      }
   };

   var packdata = (apidat) => ({request:apidat.request, lpdata:lpdata, data:apidat.data,
         clearNotifications:clearNotifications});

   var reqsig = (name, apidat, msg) => 
   {
      if(msg)
         me.log(msg + " : " + me.api.FormatData(apidat));
      me.signal(name, packdata(apidat));
   };

   var params = new URLSearchParams();
   params.append("actions", JSON.stringify({
      "lastId" : lpdata.lastId,
      "statuses" : lpdata.statuses,
      "clearNotifications" : clearNotifications,
      "chains" : [ "comment.0id", "activity.0id", "watch.0id",
         "content.1parentId.2contentId.3contentId",
         "user.1createUserId.2userId.4createUserId" ]
   }));

   if(lpdata.lastListeners)
   {
      params.append("listeners", JSON.stringify({
         "lastListeners" : lpdata.lastListeners,
         "chains" : [ "user.0listeners" ]
      }));
   }

   params.set("user","id,username,avatar");
   params.set("content","id,name,type,values,createUserId,permissions");

   me.api.Listen(params, (apidat) =>
   {
      if(apidat.abortNow)
      {
         reqsig("longpollabort", apidat, "Long poll aborted, but received data");
      }
      else
      {
         var data = apidat.data;
         if(data)
         {
            if(data.lastId)
               lpdata.lastId = data.lastId;
            if(data.listeners)
               lpdata.lastListeners = data.listeners;
         }

         if(me.instantComplete)
            me.instantComplete(packdata(apidat));

         reqsig("longpollcomplete", apidat);
         recall(apidat);
      }
   }, (apidat) =>
   {
      var req = apidat.request;
      if(req.status === 400)
      {
         reqsig("longpollfatal", apidat, "Long poller failed fatally");
      }
      else if(req.status || apidat.networkError)
      {
         var timeout = me.errortime;
         if(req.status === 429)
            timeout = me.ratetimeout;
         reqsig("longpollerror", apidat, "Long poller failed normally, retrying in " + timeout + " ms");
         setTimeout(() => recall(apidat), timeout);
      }
      else
      {
         reqsig("longpollabort", apidat, "Long poller aborted normally");
      }
   }, (apidat) =>
   {
      //At the end, remove ourselves from the pending requests
      me.pending = me.pending.filter(x => x.rid !== apidat.rid);
      reqsig("longpollalways", apidat);
   }, (apidat) =>
   {
      me.pending.push(apidat);
   }); 
};


// ****************
// --- ENDPOINT ---
// ****************

function getUserLink(id) { return "?p=user-" + id; }
function getPageLink(id) { return "?p=page-" + id; }
function getCategoryLink(id) { return "?p=category-" + id; }

function getImageLink(id, size, crop)
{
   var img = apiroot + "/file/raw/" + id;
   var linkch = "?";
   if(size) { img += linkch + "size=" + size; linkch = "&"; }
   if(crop) { img += linkch + "crop=true"; linkch = "&"; }
   return img;
}

// *******************
// --- DATA FORMAT ---
// *******************

//12me namespacing
var DataFormat = Object.create(null); with (DataFormat) (function($) { Object.assign(DataFormat, 
{
   CommentsToAggregate : function (comment)
   {
      var comments = {};

      if(comment)
      {
         comment.forEach(c =>
         {
            if(!comments[c.parentId]) 
               comments[c.parentId] = { "lastDate" : "0", "lastId" : 0, "count" : 0, "userIds" : [], "id" : c.parentId};
            var cm = comments[c.parentId];
            if(cm.userIds.indexOf(c.createUserId) < 0) cm.userIds.push(c.createUserId);
            if(c.createDate > cm.lastDate) cm.lastDate = c.createDate;
            if(c.id > cm.lastId) cm.lastId = c.id;
            cm.count++;
         });
      }

      return Object.values(comments);
   },
   ActivityToAggregate : function(activitee)
   {
      var activity = {};

      if(activitee)
      {
         activitee.forEach(a =>
         {
            if(!activity[a.contentId]) 
               activity[a.contentId] = { "lastDate" : "0", "lastId" : 0, "count" : 0, "userIds" : [], "id" : a.contentId};
            var ac = activity[a.contentId];
            if(ac.userIds.indexOf(a.userId) < 0) ac.userIds.push(a.userId);
            if(a.date > ac.lastDate) ac.lastDate = a.date;
            if(a.id > ac.lastId) ac.lastId = a.id;
            ac.count++;
         });
      }

      return Object.values(activity);
   },
   MapField : function(data, field)
   {
      field = field || "id";
      data = data || [];
      var ds = {};
      for(var i = 0; i < data.length; i++)
         ds[data[i][field]] = data[i];
      return ds;
   },
   LinkField : function(data, field, assign, linkdata, linkfield)
   {
      var links = MapField(linkdata, linkfield);
      data.forEach(x =>
      {
         if(field in x && x[field] in links)
            x[assign] = links[x[field]];
      });
   },
   GetPinnedIds : function(category)
   {
      return category.values.pinned ? category.values.pinned.split(",").filter(x => x) : [];
   },
   SetPinnedIds : function(category, pinned)
   {
      category.values.pinned = [...new Set(pinned)].join(",") || "";
   },
   AddPinned : function(category, id)
   {
      var pinned = GetPinnedIds(category);
      pinned.push(id);
      SetPinnedIds(category, pinned);
   },
   RemovePinned : function(category, id)
   {
      SetPinnedIds(category, GetPinnedIds(category).filter(x => x != id));
   },
   MarkPinned : function(category, content, moveTop)
   {
      if(!category || !content || !category.values)
         return -1;

      var pinned = GetPinnedIds(category);
      var insertSpot = 0;

      //Reorganize + mark pinned pages (SUPER dumb way to do this)
      for(var i = 0; i < content.length; i++)
      {
         content[i].pinned = pinned.some(x => x == content[i].id);

         if(content[i].pinned)
         {
            if(moveTop && insertSpot !== i)
               content.splice(insertSpot, 0, ...content.splice(i, 1));

            insertSpot++;
         }
      }

      return insertSpot;
   }
})
//Private vars can go here
}(window));



// *********************
// --- FRONTEND COOP ---
// *********************

function parseComment(content) {
   var newline = content.indexOf("\n");
   try {
      // try to parse the first line as JSON
      var data = JSON.parse(newline>=0 ? content.substr(0, newline) : content);
   } finally {
      if (data && data.constructor == Object) { // new or legacy format
         if (newline >= 0)
            data.t = content.substr(newline+1); // new format
      } else // raw
         data = {t: content};
      return data;
   }
}

function createComment(rawtext, markup, avatar) {
   var meta = {"m":markup};
   if(avatar !== undefined)
      meta.a = "avatar";
   return JSON.stringify(meta) + "\n" + rawtext;
}

//Does the given (agreed upon) page name type have discussions? This would be
//user, page, category, etc (those names)
function typeHasDiscussion(type) {
   return type === "page" || type === "user";
}
