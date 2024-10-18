import { stats_cards } from "./content.js";

async function stats_card_data() {
  // Generate HTML content using a loop
  let htmlContent = "";
  stats_cards.forEach((data) => {
    // Generate star icons based on the rating value
    let starsHtml = "";
    for (let i = 0; i < 5; i++) {
      var className;
      if (data.rating - i >= 1) {
        className = "fa-solid fa-star";
      } else if (data.rating - i > 0) {
        className = "fa-regular fa-star-half-stroke";
      } else {
        className = "fa-regular fa-star";
      }
      starsHtml += `<i class="${className}"></i>`;
    }

    htmlContent += `
        <div class="col-lg-3 col-md-6 mb-4">
            <div class="stats d-flex align-items-center">
                <div class="lh-1 text-white ${data.color} rounded-circle p-3">
                    <a href="${data.link}">
                        <i class="${data.icon} fs-4"></i>
                    </a>
                </div>
            <div class="ms-2">
                <h6 class="mb-0">${data.label}</h6>
                <span>0</span>
                <div class="rating d-flex align-items-center">
                    <div>${data.rating}</div>
                    <div class="vr mx-2"></div>${starsHtml}</div>
                </div>
            </div>
        </div>
    `;
  });

  // Set the generated HTML content to the element with ID "stats"
  $("#stats").html(htmlContent);
}

function changeTabFromQueryParam() {
  var urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has("page")) {
    const tabParam = "home";
    urlParams.set("page", tabParam);
    history.replaceState(null, null, "?" + urlParams.toString());
    $(`nav a[tab_Id="${tabParam}"]`).trigger("click");
  }
  var tabParam = urlParams.get("page");
  if (tabParam) {
    var $targetTab = $(`nav ul .nav-link[tab_Id="${tabParam}"]`);
    if ($targetTab.length > 0) {
      $(`nav a[tab_Id="${tabParam}"]`).trigger("click");
    } else {
      console.warn("Tab with data-tab='" + tabParam + "' not found.");
    }
  }
}

function doTask() {
  const promises = stats_cards.map((data) => {
    const obj = $(`#stats>div:has(a[href='${data.link}']) span`);
    const startValue = 0;
    const endValue = data.count;
    const duration = 2000;
    return animateValue(obj, startValue, endValue, duration);
  });

  Promise.all(promises).then(() => {
    $(`#stats>div:has(a[href="javascript:void(0);"]) span`).append("+");
  });
}

$(document).ready(() => {
  var paths = document.querySelectorAll("#loader path");
  paths.forEach(function (path) {
    var length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;
    path.getBoundingClientRect();
    path.style.animation = "2s linear 0s 1 forwards svganimationstroke";
  });
  // Show loader when page starts loading
  $(window).on("load", () => {
    setTimeout(() => {
      $("#loader").fadeOut("slow", () => doTask());
    }, 800);
  });
  changeTabFromQueryParam();
  stats_card_data();
});
