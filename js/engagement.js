// Engagement.js

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState == 'hidden') {
    document.title = "Hidden Tools & Resources";
  }
  if (document.visibilityState == 'visible') {
    document.title = "Visible Tools & Resources";
  }
});