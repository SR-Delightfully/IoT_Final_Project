import { useState } from "react";

// Product picture, or the first letter of its name when there is no image.
function ProductImage({ product, className = "" }) {
  const [broken, setBroken] = useState(false);

  if (!product.product_image_url || broken) {
    return (
      <div className={`product-image product-image-empty ${className}`}>
        {product.product_name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      className={`product-image ${className}`}
      src={product.product_image_url}
      alt={product.product_name}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

export default ProductImage;
