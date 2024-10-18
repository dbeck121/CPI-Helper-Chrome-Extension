import { baseUrl } from "./content.js";

$(".logo").each(function () {
  // Fetch SVG file

  fetch(baseUrl + "images/logo.svg")
    .then((response) => response.text())
    .then((svgData) => {
      var div = document.createElement("div");
      div.innerHTML = svgData;
      var svgElement = div.querySelector("svg");
      $(this).append(svgElement);
    });
});

function adjustSectionMargin() {
  const navHeight = document.querySelector(".navbar").offsetHeight;
  const footerHeight = document.querySelector("footer").offsetHeight;
  const sections = document.querySelectorAll("section");
  sections.forEach((section) => {
    section.style.marginTop = `${navHeight}px`;
    section.style.marginBottom = `${footerHeight}px`;
  });
}

// Call the function initially and on window resize
adjustSectionMargin();
window.addEventListener("resize", adjustSectionMargin);
