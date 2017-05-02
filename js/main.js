// Enjoy your day
(function () {
  var today;
  today = function () {
    var dayNames, now;
    dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    now = new Date();
    return dayNames[now.getDay()];
  };
  $(function () {
    var $day;
    $day = $('[data-day]');
    return $day.text(today());
  });
}).call(this);

// Confirm with users before opening any mailto: link through their default email client.
// http://mmoustafa.com/experiments/mailto/
!function(t){t.fn.confirmMailto=function(e){var n=t.extend({message:"Do you want to send an email to $to?",to:"href",callback:function(){},success:function(){},fail:function(){}},e),a=/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,i=function(e){var i=n.message,c=n.to;if(c="href"==c?t(this).attr("href").match(a):"html"==c?t(this).html():c,i=i.replace("$to",c)==i?i+c:i.replace("$to",c),confirm(i)){n.success();var o=!0}else{e.preventDefault(),n.fail();var o=!1}return setTimeout(function(){n.callback(o)},1),o};return this.filter('[href^="mailto:"]').each(function(){t(this).bind("click",i)}),this}}(jQuery);

$(document).ready(function(){
  $('a').confirmMailto();
});

// Don't forget me!
// Example: http://www.mt.nl
// var focusTitle = "";
// var blurTitle  = "Dont' forget me!";
// jQuery(window).addEvent('blur', function() {
//   focusTitle = $$('title').shift().innerHTML;
//   $$('title').shift().innerHTML = blurTitle + " | " + focusTitle;
// });
// jQuery(window).addEvent('focus', function() {
//   if (focusTitle.length > 0) {
//     $$('title').shift().innerHTML = focusTitle;
//   }
// });
