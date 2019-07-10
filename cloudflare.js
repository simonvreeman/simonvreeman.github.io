// <script src="https://vreeman.com/cloudflare.js" importance="high" async defer></script>
console.log('https://vreeman.com/cloudflare.js is loaded.');

callFunctionFromScript

function callFunctionFromScript() {
  var today = new Date();
  var date = new Date();
  var days = document.getElementById('days').value;
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  expires = date.toUTCString();
  console.log(today);
  console.log(date);
  // document.cookie = "vreeman-js=" + today + "; expires=" + expires + "; path=/";
}