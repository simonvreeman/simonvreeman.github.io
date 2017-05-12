// Engagement.js

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState == 'hidden') {
    document.title = "😟 Tools & Resources";
  }
  if (document.visibilityState == 'visible') {
    document.title = "😄 Tools & Resources";
  }
});