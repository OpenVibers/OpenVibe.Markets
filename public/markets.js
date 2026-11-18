// OpenVibe.Markets: search by photo. The chosen photo is redrawn at most 1024 px wide as a JPEG (smaller, faster, and
// the camera's own data, its place included, is not carried over), then sent once for OpenVibe Vision to name.
(function () {
    document.addEventListener('change', function (e) {
        var input = e.target;
        if (!input || !input.matches || !input.matches('input[data-mk-photo]') || !input.files || !input.files[0]) return;
        var form = input.closest('form');
        var out = form && form.querySelector('[data-mk-image]');
        var said = form && form.querySelector('[data-mk-photo-said]');
        if (!out) return;
        var file = input.files[0];
        if (!/^image\//.test(file.type)) { if (said) said.textContent = 'That is not a photo.'; return; }
        if (said) said.textContent = 'Looking at your photo…';
        form.classList.add('is-busy');
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            var scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.naturalWidth * scale));
            c.height = Math.max(1, Math.round(img.naturalHeight * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            out.value = c.toDataURL('image/jpeg', 0.85);
            form.submit();
        };
        img.onerror = function () { URL.revokeObjectURL(url); form.classList.remove('is-busy'); if (said) said.textContent = 'That photo could not be opened.'; };
        img.src = url;
    });
})();
