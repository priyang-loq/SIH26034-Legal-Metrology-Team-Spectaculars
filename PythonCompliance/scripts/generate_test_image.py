import cv2
import numpy as np
import os

# Create data/test_images if not exists
os.makedirs("data/test_images", exist_ok=True)

# Create a white image
img = np.ones((500, 500, 3), dtype=np.uint8) * 255

# Add text to the image
cv2.putText(img, "M.R.P. Rs. 199.50 (Incl. of all taxes)", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
cv2.putText(img, "Net Quantity: 400 g", (30, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
cv2.putText(img, "Mfg Date: 12/05/2023", (30, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
cv2.putText(img, "Best Before: 10/24", (30, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

# Save the image
cv2.imwrite("data/test_images/dummy.jpg", img)
print("Created dummy test image at data/test_images/dummy.jpg")
