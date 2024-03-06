function tabchange(id) {
    $('nav a[href="#' + id + '"]').trigger('click');
}
$('#menuToggle').click(function () {
    $(this).find('span').toggleClass('fa-bars fa-times'); // Toggle between bars and times icons
});

