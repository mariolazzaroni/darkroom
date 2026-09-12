from PIL import Image, ImageFilter


def apply_sharpening(image: Image.Image, sharpening: float) -> Image.Image:
    if sharpening == 0:
        return image
    return image.filter(
        ImageFilter.UnsharpMask(
            radius=1.2,
            percent=int(40 + sharpening * 1.8),
            threshold=2,
        )
    )

