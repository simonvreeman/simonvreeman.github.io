// Engagement.js
var pageTitle = document.title;

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState == 'hidden') {
    document.title = "😟 " + pageTitle;
  }
  if (document.visibilityState == 'visible') {
    document.title = "😄 " + pageTitle;
  }
});