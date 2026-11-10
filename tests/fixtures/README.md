The `bird*.rgba.gz` fixtures contain gzip-compressed RGBA pixels (row-major,
8 bits per channel) from the live Bird of the Day integration preview captured
through the Dev editor on 2026-11-10. Portrait is 480×800; landscape is 800×480.
Source: https://integrations.paperlesspaper.de/bird-of-the-day/render.html

The browser supplied JPEG screenshots. Their decoded pixels are stored here
without further loss so tests need neither a browser, network, JPEG library nor
ImageMagick. These deliberately retain JPEG edge artifacts. They exercise text
and a continuous-tone cutout on one shared white background. They do not stand
in for a lossless server rendering or a physical display test.
