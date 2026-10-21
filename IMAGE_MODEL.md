# Image model integration

The image detector uses the team's MTCNN face crop and EfficientNet-B0 weights in `models/best_model-v3.pt`. MTCNN uses a 224 × 224 crop, margin 20, and thresholds `[0.5, 0.6, 0.6]`; if it finds no face, the detector processes the full image. The model input is resized to 224 × 224 and normalized with ImageNet mean and standard deviation. Its classes are `0 = FAKE` and `1 = REAL`.

Install the backend dependencies with `pip install -r requirements.txt`, then run the FastAPI server as usual. If the weights are stored elsewhere, set `IMAGE_MODEL_PATH` in `.env` to the weights file path. By default the backend loads `models/best_model-v3.pt` from this project directory.

## API

`POST /analyze/image` accepts an authenticated multipart upload with the field name `file`. Supported extensions are JPG, JPEG, and PNG; the existing 50 MB upload limit applies. A successful analysis also saves the image to the user's upload history.

The response includes the upload record, predicted class, confidence percentage, real and fake probabilities, and a threat level. Image analysis requires PyTorch, torchvision, Pillow, and facenet-pytorch; the server still starts without them, but the endpoint returns `503` with setup guidance when the runtime or model weights are unavailable.
