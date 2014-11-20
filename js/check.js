function updateOutput() {
  var uri = document.getElementById('url');
  var uri_enc = encodeURIComponent(uri);
  var uri_dec = decodeURIComponent(uri_enc);




  var domain = $('#domain').val();

  var html = domain;

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

http://online-code-generator.com/url-decode.php
