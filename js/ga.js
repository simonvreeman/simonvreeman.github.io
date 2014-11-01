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