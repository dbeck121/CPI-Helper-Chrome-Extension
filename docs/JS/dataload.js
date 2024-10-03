import { prev_feature, contributors, baseUrl, features } from "./content.js";
async function features_home() {
  const collection = ["fa-wrench", "fa-toolbox", "fa-cogs", "fa-hammer"];
  const colors = ["bg-warning", "bg-danger", "bg-info", "bg-success", "bg-primary"];
  const feature = document.querySelector("#features div.row");
  features.forEach(
    (it, index) =>
      (feature.innerHTML += `<div class="col mb-5"><div class="feature ${colors[index % colors.length]} bg-gradient text-white rounded-3 mb-3"><i class="fas ${collection[index % collection.length]}"></i></div>
        <h2 class="h5">${it.title}</h2><p class="mb-0">${it.desc}</p></div>`)
  );
  $("#home > header > div > div img").attr("src", baseUrl + "/images/undraw_in_sync_re_jlqd.svg");
  // $('img[alt="Logo"]').attr('src', baseUrl + "/images/logo.svg");
}

// contributors details onload
async function users_details() {
  contributors.forEach((it) => {
    var div = document.createElement("div");
    div.innerHTML = `<div class="text-center"><a href="https://github.com/${it.username}">
        <img class="img-fluid rounded-circle mb-4 px-4" src="https://github.com/${it.username}.png" alt="..." /></a>
        <h5 class="fw-bolder">${it.name.replace(/\b\w/g, (c) => c.toUpperCase())}</h5>
        <div class="fst-italic text-muted"></div>
    </div>`;
    document.getElementById("contributor").append(div);
  });
}
async function carousel() {
  const carouselInner = document.querySelector("#carouselhome > div");

  // Add prev_feature dynamically
  prev_feature.forEach((slide, index) => {
    const carouselItem = document.createElement("div");
    carouselItem.classList.add("carousel-item");
    if (index === 0) {
      carouselItem.classList.add("active");
    }

    const img = document.createElement("img");
    img.src = baseUrl + "/images/screenshots/" + slide.image;
    img.classList.add("d-block", "w-100");
    carouselItem.appendChild(img);

    const carouselCaption = document.createElement("div");
    carouselCaption.classList.add("carousel-caption", "d-none", "d-md-block");
    const captionTitle = document.createElement("h5");
    captionTitle.textContent = slide.caption;
    carouselCaption.appendChild(captionTitle);
    const captionDesc = document.createElement("p");
    captionDesc.textContent = slide.description;
    carouselCaption.appendChild(captionDesc);
    carouselItem.appendChild(carouselCaption);

    carouselInner.appendChild(carouselItem);
  });

  // Initialize carousel instance
  const carouselInstance = new bootstrap.Carousel(document.querySelector(".carousel"), {
    interval: 3000, // Change slide every 3 seconds
  });

  // Previous and next button event listeners
  document.querySelector(".carousel-control-prev").addEventListener("click", function () {
    carouselInstance.prev();
  });

  document.querySelector(".carousel-control-next").addEventListener("click", function () {
    carouselInstance.next();
  });
}

window.onload = async function () {
  await features_home();
  await users_details();
  await carousel();
};
