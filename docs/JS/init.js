import { stats_cards } from './content.js'

function adjustSectionMargin() {
    const navHeight = document.querySelector('.navbar').offsetHeight;
    const footerHeight = document.querySelector('footer').offsetHeight;
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.style.marginTop = `${navHeight}px`;
        section.style.marginBottom = `${footerHeight}px`;
    });
}
// Call the function initially and on window resize
adjustSectionMargin();
window.addEventListener('resize', adjustSectionMargin);

async function stats_card_data() {
    // Generate HTML content using a loop
    let htmlContent = "";
    stats_cards.forEach(data => {
        // Generate star icons based on the rating value
        let starsHtml = "";
        for (let i = 0; i < 5; i++) {
            var className;
            if ((data.rating - i) >= 1) {
                className = "fa-solid fa-star"
            } else if ((data.rating - i) > 0) {
                className = "fa-regular fa-star-half-stroke"
            } else {
                className = "fa-regular fa-star";
            }
            starsHtml += `<i class="${className}"></i>`
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
                <span>${data.count}</span>
                <div class="rating d-flex align-items-center">
                    <div>${data.rating}</div>
                    <div class="vr mx-2"></div>${starsHtml}</div>
                </div>
            </div>
        </div>
    `;
    });

    // Set the generated HTML content to the element with ID "stats"
    $('#stats').html(htmlContent);
    const promises = stats_cards.map(data => {
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

function changeTabFromQueryParam() {
    var urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('page')) {
        urlParams.set('page', 'home');
        history.replaceState(null, null, '?' + urlParams.toString());
    }
    var tabParam = urlParams.get('page');
    if (tabParam) {
        var $targetTab = $('nav ul .nav-link[href="#' + tabParam + '"]');
        if ($targetTab.length > 0) {
            tabchange(tabParam)
        } else {
            console.warn("Tab with data-tab='" + tabParam + "' not found.");
        }
    }
}

$(document).ready(function () {
    $('.nav-link').on('click', function (event) {
        event.preventDefault();
        const targetId = $(this).attr('href').substring(1);
        $('section').addClass('hide');
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        $(`#${targetId}`).removeClass('hide');
        var urlParams = new URLSearchParams(window.location.search);
        urlParams.set('page', targetId);
        history.replaceState(null, null, '?' + urlParams.toString());
    });
    changeTabFromQueryParam()
    stats_card_data();
});