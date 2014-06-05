// Enjoy your ...
(function() {
    var today;
    today = function() {
      var dayNames, now;
      dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      now = new Date();
      return dayNames[now.getDay()];
    };
    $(function() {
      var $day;
      $day = $('[data-day]');
      return $day.text(today());
    });
}).call(this);
// Tooltips
$(document).ready(function(){$('[data-toggle="tooltip"]').tooltip({trigger:'hover','placement':'top'});});
// Share to Whatsapp
whatsappShareButton: function() {
  var self = this;
  $('.share-whatsapp').on('click', function() {
    var protocol = 'whatsapp://send?text=';
    var title = $('h1').text();
    var link = $('meta[property="og:url"]').attr('content');
    var message = protocol + self.customEmailMessageEncoder(title) + '%0A%0D' + self.customEmailMessageEncoder(link);
    window.open(message , '_self');
  });
}