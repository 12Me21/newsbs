//Carlos Sanchez
//9-18-2019
//Deps: jquery, constants


//Lots of dependencies since this basically MAKES the app.
function AppGenerate(logger, request, htmlUtils, formGenerate, spa, template) 
{
   this.Log = logger;
   this.request = request;
   this.htmlUtils = htmlUtils;
   this.formGenerate = formGenerate;
   this.spa = spa;
   this.template = template;
}

AppGenerate.prototype.SingleUseFormSuccess = function(form, data)
{
   var submit = this.formGenerate.GetSubmit(form);
   //this.generate.SetElementIcon(submit, IMAGES.Success);
};

AppGenerate.prototype.RefreshCurrentContent = function()
{
   this.Log.Debug("Refreshing current content");
   this.spa.ProcessLink(document.location.href);
};

AppGenerate.prototype.CreateHome = function()
{
   this.Log.Debug("Creating Homepage");

   var main = this.template.RenderElement("section");

   var header = $("<h1>SmileBASIC Source</h1>");
   var about = this.template.RenderElement("content", "One day, this might become something??? I've said that about " +
      "quite a few projects though... none of which went anywhere");
   var explain = this.template.RenderElement("content", "Some things: Yes, the sidebar will be collapsible and maybe " +
      "even resizable. No, nothing is final. No, I'm not focusing on ultra-old " +
      "devices first, although I am looking for it to be stable on at least " +
      "sort-of old things. Yes, I'm really using jquery, it's here to stay. " +
      "No, I'm not going to use 1 million libraries; just jquery and MAYBE one " +
      "or two other things. I'm trying to make the underlying html and css as " +
      "simple as possible to both understand and manipulate... I don't want to have a mess " +
      "just as much as anybody else trying to manipulate this crap.\n\nYes, I'm " +
      "trying to fit the entire website into one window. Yes, everything will " +
      "be AJAX and done through jquery (sorry non-js people). Yes, IF I get time, " +
      "I still plan on an 'ultra low-end no js' version of the website, but that's " +
      "only if people still need that after I'm finished with this one. Yes I'm " +
      "open to suggestions, but I'm trying to avoid feature creep so unless it's " +
      "super pressing, I might hold off on it. Yes, the website database gets " +
      "reset every time I publish; when the website WORKS I will stop doing " +
      "that.\n\n\nOh one more thing: this is running off a junky little " +
      "laptop at home with bad internet. Sorry if at any point it's bad.");
   main.append(header);
   main.append(about);
   main.append(explain);

   return main;
};

AppGenerate.prototype.CreateTestArea = function()
{
   this.Log.Debug("Creating Test Area");

   var main = this.template.RenderElement("section");
   var header = $("<h1>Test Area</h1>");
   var me = this;

   main.append(header);
   main.append(me.CreateContentForm());

   me.request.GetMasterCategory(function(ctg)
   {
      me.request.GetAllContent(ctg["id"], CONTENTTYPES.Discussion, function(data)
      {
         var contents = data["collection"];
         var content = me.template.RenderElement("content");

         for(var i = 0; i < contents.length; i++)
         {
            var url = me.GetSpaUrl("?p=" + contents[i]["id"])
            var lnk = me.template.RenderElement("contentLink",
            {
               text: contents[i]["title"],
               link: url
            });
            lnk.click(me.spa.ClickFunction(url));
            content.append(lnk);
         }

         main.append(content);
      });
   });

   return main;
};

AppGenerate.prototype.CreateLogin = function()
{
   this.Log.Debug("Creating Login/Register page");

   var main = this.template.RenderElement("section");
   var registerNotes = this.template.RenderElement("content", "Registering is a bit of a hassle right now " + 
      "sorry. You must first use the register form to make your account. You will " +
      "only know it succeeded because there's a green checkmark. Then you must " +
      "send the confirmation email. Again, a green checkmark. NEXT, you get the " +
      "code from the email and put it in the 'Confirm' form. If you get another " +
      "green checkbox, hey, now you can login!");
   main.append(this.CreateLoginForm());
   main.append(registerNotes);
   main.append(this.CreateRegisterForm());
   main.append(this.CreateEmailSendForm());
   main.append(this.CreateRegisterConfirmForm());

   return main;
};

AppGenerate.prototype.CreateLoginForm = function()
{
   var fg = this.formGenerate;
   var form = this.template.RenderElement("form", 
   {
      standalone: true,
      name: "Login",
      inputs: fg.GetLogin()
   });
   var me = this;
   //fg.AddLogin(form);
   fg.SetupAjax(form, API.Authorize, fg.GatherLoginValues.bind(fg), function(form, data)
   {
      me.request.SetAuthToken(data);
      me.RefreshCurrentContent();
      //me.RefreshMe(); //go get the new user data and update buttons/whatever
   });
   return form;
};

AppGenerate.prototype.CreateRegisterForm = function()
{
   var fg = this.formGenerate;
   var formData = {
      standalone: true,
      name: "Register",
      inputs: [
         { name: "email", type: "email", text: "Email" },
         { name: "username", type: "text", text: "Username" },
      ]
   };
   formData.inputs = formData.inputs.concat(fg.GetPasswordConfirm());
   var form = this.template.RenderElement("form", formData);
   //fg.AddPasswordConfirm(form);
   fg.SetupAjax(form, API.Credentials, fg.GatherPasswordConfirmValues.bind(fg), this.SingleUseFormSuccess.bind(this));
   return form;
};

AppGenerate.prototype.CreateEmailSendForm = function()
{
   var fg = this.formGenerate;
   var form = this.template.RenderElement("form",
   {
      standalone: true,
      name: "Send Confirmation Email",
      submit: "Send",
      inputs: [
         { name: "email", type: "email", text: "Email" }
      ]
   });
   fg.SetupAjax(form, API.SendEmail, fg.GatherValues.bind(fg), this.SingleUseFormSuccess.bind(this));
   return form;
};

AppGenerate.prototype.CreateRegisterConfirmForm = function()
{
   var fg = this.formGenerate;
   var form = this.template.RenderElement("form",
   {
      standalone: true,
      name: "Confirm Registration",
      submit: "Confirm",
      inputs: [
         { name: "confirmationKey", type: "text", text: "Email Code" }
      ]
   });
   fg.SetupAjax(form, API.ConfirmEmail, fg.GatherValues.bind(fg), this.SingleUseFormSuccess.bind(this));
   return form;
};

AppGenerate.prototype.CreateContentForm = function()
{
   var fg = this.formGenerate;
   var form = this.template.RenderElement("form",
   {
      standalone: true,
      name: "New Discussion",
      inputs: [
         { name: "title", type: "text", text: "Title" },
         { name: "content", textarea: "true", text: "Content" },
         { name: "type", type: "hidden", value: CONTENTTYPES.Discussion },
         { name: "format", type: "hidden", value: CONTENTFORMATS.Plain },
         { name: "baseAccess", type: "hidden", value: WEBSITE.DefaultContentAccess },
         { name: "categoryId", type: "hidden", number: true }
      ]
   });
   fg.SetupAjax(form, API.Content, fg.GatherValues.bind(fg), this.SingleUseFormSuccess.bind(this));
   fg.SetRunning(form);
   this.request.GetMasterCategory(function(data) 
   { 
      form.find('[name="categoryId"]').val(data["id"]);
      fg.ClearRunning(form);
   });
   return form;
};

AppGenerate.prototype.CreateUserHome = function(user)
{
   var section = this.template.RenderElement("section"); //generate.MakeSection();
   var content = this.template.RenderElement("content"); //generate.MakeContent();
   var header = $("<h1></h1>");
   var me = this;
   header.text(user.username);
   var logout = $('<a href="#">logout</a>');
   logout.click(function(event)
   {
      event.preventDefault();
      me.request.RemoveAuthToken();
      me.RefreshCurrentContent();
   });
   //var icon = this.generate.MakeIconButton(IMAGES.Logout, "#FF4400", function(b)
   //{
   //   me.request.RemoveAuthToken();
   //   me.RefreshCurrentContent();
   //   //me.RefreshMe(); //go get the new user data and update buttons/whatever
   //});

   content.append(logout);
   section.append(header);
   section.append(content);

   return section;
};

AppGenerate.prototype.GetSpaUrl = function(url)
{
   //This is the WRONG way to do this.
   return window.location.href.split('?')[0] + url;
};

/*AppGenerate.prototype.QuickSpaElement = function(element, url)
{
   url = this.GetSpaUrl(url);
   element.click(this.spa.ClickFunction(url));
};*/

/*AppGenerate.prototype.CreateSpaLink = function(url)
{
   url = window.location.href.split('?')[0] + url;
   var link = $("<a></a>");
   //console.log("SETTING UP SPA LINK FOR " + url);
   this.spa.SetupClickable(link, url);
   link.attr("href", url);
   return link;
};*/

/*AppGenerate.prototype.CreateSpaIcon = function(url, image, color)
{
   var icon = this.CreateSpaLink(url);
   this.generate.SetupIcon(icon, image, color);
   return icon;
};*/

