// http://online-code-generator.com/url-decode.php

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

// Encode and decode
function updateOutput() {
  var domain = $('#domain').val();

  var uri_enc = encodeURIComponent(domain);
  var uri_dec = decodeURIComponent(domain)

  $('#enc_url').html(uri_enc);
  $('#enc_url').change();

  $('#dec_url').html(uri_dec);
  $('#dec_url').change();

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

//
var sBrowser, sUsrAg = navigator.userAgent;

if(sUsrAg.indexOf("Chrome") > -1) {
    sBrowser = "Google Chrome";
} else if (sUsrAg.indexOf("Safari") > -1) {
    sBrowser = "Apple Safari";
} else if (sUsrAg.indexOf("Opera") > -1) {
    sBrowser = "Opera";
} else if (sUsrAg.indexOf("Firefox") > -1) {
    sBrowser = "Mozilla Firefox";
} else if (sUsrAg.indexOf("MSIE") > -1) {
    sBrowser = "Microsoft Internet Explorer";
}
var navigator_txt = "";
navigator_txt += "<p>Browser CodeName: " + navigator.appCodeName + "</p>";
navigator_txt += "<p>Browser Name: " + navigator.appName + "</p>";
navigator_txt += "<p>Browser Version: " + navigator.appVersion + "</p>";
navigator_txt += "<p>Cookies Enabled: " + navigator.cookieEnabled + "</p>";
navigator_txt += "<p>Do Not Track Enabled: " + navigator.doNotTrack + "</p>";
navigator_txt += "<p>Browser Language: " + navigator.language + "</p>";
navigator_txt += "<p>Browser Online: " + navigator.onLine + "</p>";
navigator_txt += "<p>Platform: " + navigator.platform + "</p>";
navigator_txt += "<p>User-agent header: " + navigator.userAgent + "</p>";
navigator_txt += "<p>You are using: " + sBrowser + "</p>";

document.getElementById("navigator_txt").innerHTML = navigator_txt;
