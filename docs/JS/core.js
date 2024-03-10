function tabchange(id) {
    $('nav a[href="#' + id + '"]').trigger('click');
}
$('#menuToggle').click(function () {
    $(this).find('span').toggleClass('fa-bars fa-times'); // Toggle between bars and times icons
});

function animateValue(obj, start, end, duration) {
    return new Promise(resolve => {
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

