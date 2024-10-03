function tabchange(targetId) {
  $("section").addClass("hide");
  $(".nav-link").removeClass("active");
  $(`nav a[tab_Id="${targetId}"]`).addClass("active");
  $(`#${targetId}`).removeClass("hide");
  var urlParams = new URLSearchParams(window.location.search);
  urlParams.set("page", targetId);
  history.replaceState(null, null, "?" + urlParams.toString());
  if ($("#menuToggle").find("span").hasClass("fa-times")) {
    $("#menuToggle").trigger("click");
  }
}

// Toggle between bars and times icons
$("#menuToggle").click(function () {
  $(this).find("span").toggleClass("fa-bars fa-times");
});

function animateValue(obj, start, end, duration) {
  return new Promise((resolve) => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.text(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    window.requestAnimationFrame(step);
  });
}
