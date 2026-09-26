# Product galleries and 360-degree views

## Galleries

For each actual product, photograph a front view, back view, side view, stitch close-up, and an appropriate scale or worn view. Place the files in `public/assets`, then add their `/assets/filename.jpg` paths in the product editor. HTTPS image URLs are also supported. Set the lead photo in the main image field and additional photos in the gallery field, one per line. Keep photographs of other designs out of this gallery.

The storefront supports swipe/scroll, previous/next buttons, keyboard arrows while the gallery has focus, and thumbnails. One-photo products retain a single-photo display until more photos are supplied.

## Rotation

1. Use a stationary camera, fixed lighting, and a plain background.
2. Put the product on a turntable; use a mannequin or a suitable support for soft garments so the silhouette stays consistent.
3. Capture a full turn clockwise in equal increments. Aim for 24–36 frames. The viewer accepts 4–72; fewer frames create larger jumps.
4. Keep framing, scale, white balance, and exposure consistent. Name files in rotation order, such as `bag-angle-01.jpg` through `bag-angle-24.jpg`.
5. Enter every path in rotation order in **Admin → Products → Edit → 360° image sequence**. Save and open the product page.
6. Use the 360° button. Drag horizontally or use the keyboard-accessible slider to rotate. The control is enabled after all frames load; a failed frame reports a loading error rather than showing a broken spin.

This is an image-sequence viewer, not a 3D reconstruction. It does not infer the hidden sides of a product or require an AI service. Initial sample products have no rotation sequence. Browser verification uses temporary test photos to exercise the controls; those fixtures are not written to the real catalog.

## Where AI can help

AI can help prepare consistent backgrounds or lighting from real supplied photographs. Any edited output should be checked against the originals for stitch pattern, yarn thickness, colour, straps, openings, proportions, and silhouette. Generating unseen angles from a single photo can invent details, so those should not be presented as verified views of the actual piece.

No AI account, API integration, or automatic image generation is configured in the admin. Actual multi-angle source images are needed to prepare trustworthy product sequences.
