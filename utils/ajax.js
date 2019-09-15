//Carlos Sanchez
//9-15-2019
//Deps: jquery 

function GetAjaxSettings(url, data)
{
   var settings = {
      url : url,
      contentType: 'application/json',
      dataType: 'json',
      beforeSend : function(xhr)
      {
         var auth = GetAuthToken();

         if(auth)
            xhr.setRequestHeader("Authorization", "Bearer " + auth);
      }
   };

   if(data !== undefined)
   {
      settings.method = "POST";
      settings.data = JSON.stringify(data);
   }
   else
   {
      settings.method = "GET";
   }

   return settings;
}

function GetResponseErrors(response)
{
   var errors = [];

   if(response.responseJSON && response.responseJSON.errors)
   {
      var rErrors = response.responseJSON.errors;

      for(var k in rErrors) 
         if(rErrors.hasOwnProperty(k))
            errors = errors.concat(rErrors[k]);
   }
   else
   {
      errors.push(response.responseText);
   }

   return errors;
}
