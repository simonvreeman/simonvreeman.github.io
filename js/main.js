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

// Tooltips
$(document).ready(function () {
  $('[data-toggle="tooltip"]').tooltip({trigger:'hover','placement':'top'});
});
$(document).ready(function () {
  $('[data-toggle="popover"]').popover({trigger:'click','placement':'top'});
});

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

// Auto-growing textareas; technique ripped from Facebook
(function ($) {
  $.fn.autogrow = function(options) {
    this.filter('textarea').each(function() {
      var $this = $(this), minHeight = $this.height(), lineHeight = $this.css('lineHeight');
      var shadow = $('<div></div>').css({
        position: 'absolute',
        top: -10000,
        left: -10000,
        width: $(this).width(),
        fontSize: $this.css('fontSize'),
        fontFamily: $this.css('fontFamily'),
        lineHeight: $this.css('lineHeight'),
        resize: 'none'
      }).appendTo(document.body);
      var update = function() {
        var val = this.value.replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&/g, '&amp;')
        .replace(/\n/g, '<br/>');
        shadow.html(val);
        $(this).css('height', Math.max(shadow.height() + 20, minHeight));
      }
      $(this).change(update).keyup(update).keydown(update);
        update.apply(this);
    });
    return this;
  }
})(jQuery);

// Google Analytics Campaign URL Builder
function updateOutput() {
  var domain = $('#domain').val();
  var source = $('#source').val();
  var medium = $('#medium').val();
  var term = $('#term').val();
  var content = $('#content').val();
  var name = $('#name').val();

  var html = domain+'?utm_source='+encodeURIComponent(source)+'&utm_medium='+encodeURIComponent(medium)+'&utm_campaign='+encodeURIComponent(name);
  if (term) {
    var html = html + '&utm_term='+encodeURIComponent(term);
  }
  if (content) {
    var html = html + '&utm_content='+encodeURIComponent(content);
  }

  if (domain && source && medium && name) {
    $('#url').html(html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    $('#url').change();
  }
  else {
    $('#url').html('');
    $('#url').change();
  }
}

function initpage() {
  $('.auto').autogrow();
  $('.auto').click(function() {
    $(this).select();
  });
  $('input').keyup(window.updateOutput);
  $('input').click(window.updateOutput);
  $('select').change(window.updateOutput);

  updateOutput();
}
$(window.initpage);
