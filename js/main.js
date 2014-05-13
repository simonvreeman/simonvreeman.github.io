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