# SpecularButton: The Button No One Wanted

A high-fidelity, 3D-transformed "mirror" button that tracks your face in real-time and uses AI to analyze your "vibe."

Built in 20 minutes because people said it was overcomplicated. It's not. It's just math and a bit of "vibe coding" with Gemini.

## 🚀 The Tech Stack

- **React 19**: Frontend framework.
- **Vite**: Ultra-fast build tool and dev server.
- **MediaPipe Face Landmarker**: Real-time, on-device face tracking (GPU accelerated).
- **Google Gemini 1.5 Flash**: Multi-modal AI for "Aura/Mood" analysis via image-to-JSON.
- **Tailwind CSS**: For the minimal, glassmorphic UI.

## 🧠 How It Works

### 1. Optical Engine (Face Tracking)
The app uses MediaPipe's Face Landmarker to detect 478 3D face landmarks. We specifically track the nose, eyes, and chin to calculate:
- **Pitch, Yaw, and Roll**: Used to drive the CSS `rotateX`, `rotateY`, and `rotateZ` transforms of the button.
- **Proximity**: Calculated based on the bounding box width of the face, driving the `scale` and `translateZ` depth.
- **Smoothing**: All movements are processed through a lerp (Linear Interpolation) function to ensure the button feels fluid, not jittery.

### 2. Specular Reflection
The "mirror" effect is achieved by:
- A live camera feed mapped onto the button surface with `object-cover`.
- CSS `backdrop-blur-3xl` and multiple layers of semi-transparent gradients.
- Dynamic specular highlights that move in opposition to your head rotation, simulating light hitting a glass surface.

### 3. Aura Analysis
When you press the button:
1. A frame is captured from the hidden canvas.
2. The base64 image is sent to **Gemini 1.5 Flash**.
3. The AI returns a JSON response containing a hex color and a mood description.
4. The entire app's background "orbs" and the button's internal glow sync to your detected aura.

## 🛠️ Installation & Setup

1. **Clone the repo**
2. **Install dependencies**:
   ```powershell
   npm install
   ```
3. **Environment Variables**:
   Create a `.env` file in the root:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. **Run Dev Server**:
   ```powershell
   npm run dev
   ```

## ⚠️ Disclaimer
This was an experiment. It uses your camera. It uses AI. It's probably overkill for a button. Use it anyway.
