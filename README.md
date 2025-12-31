# 🌀 Manifold

**Real-time 3D reconstruction from a single image, powered by [fal.ai](https://fal.ai)**

Manifold is a Next.js application that streams and visualizes 3D voxel data in real-time using SAM-3D. Watch as your 2D images transform into 3D models through an immersive, live visualization of the diffusion process.

<p align="center">
  <img src="frontend/public/logo.png" alt="Manifold Logo" width="300" />
</p>

---

## ✨ Features

- **🎬 Real-Time Streaming** — Watch the 3D reconstruction happen live with SSE streaming
- **📦 Voxel Visualization** — See geometry emerge voxel-by-voxel during diffusion
- **🎨 Color Evolution** — Watch appearance diffusion paint the model in real-time
- **🔷 Mesh Preview** — Instant vertex-colored mesh preview before final export
- **💾 GLB Export** — Download the final textured 3D model
- **🖼️ Image Generation** — Generate input images from text prompts via fal.ai
- **🎮 ViewCube Navigation** — Fusion 360-style camera controller
- **📊 Live Logs** — Streaming log panel for debugging

---

## 🏗️ Architecture

```
manifold/
├── frontend/           # Next.js web application
│   ├── app/
│   │   ├── components/ # React components (VoxelViewer, ViewCube, etc.)
│   │   ├── hooks/      # Custom hooks (useSAM3DStream)
│   │   └── lib/        # Types, decoders, constants
│   └── public/         # Static assets
│
├── serverless/         # fal.ai serverless endpoint
│   ├── app.py          # SAM-3D streaming endpoint
│   └── pyproject.toml  # fal app configuration & dependencies
│
└── sam-3d/             # Git submodule - forked SAM-3D Objects repo
```

---

## 📋 Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11 (for serverless development)
- **pnpm** or **npm** (package manager)
- **fal.ai account** with API key
- **Git** with submodule support

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone --recurse-submodules https://github.com/YOUR_USERNAME/manifold.git
cd manifold
```

If you already cloned without submodules:
```bash
git submodule update --init --recursive
```

### 2. Set up the frontend

```bash
cd frontend
npm install   # or pnpm install
```

### 3. Configure environment variables

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_FAL_API_KEY=your_fal_api_key_here
NEXT_PUBLIC_FAL_ENDPOINT_ID=your_deployed_endpoint_id
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🔧 Detailed Setup

### Frontend

The frontend is a Next.js 14+ application with React Three Fiber for 3D rendering.

```bash
cd frontend
npm install
npm run dev     # Development
npm run build   # Production build
npm run start   # Production server
```

**Key dependencies:**
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — Useful Three.js helpers
- `three` — 3D graphics library
- `@fal-ai/client` — fal.ai SDK for API calls

### Serverless Backend

The `serverless/app.py` is a fal.ai serverless function that:
1. Accepts an image URL and optional prompts
2. Runs SAM-3D reconstruction on H100 GPU
3. Streams voxel/mesh data via Server-Sent Events (SSE)
4. Returns final GLB and Gaussian splat files

The project uses `pyproject.toml` for configuration, following fal's internal registry pattern.

**Deploying to fal.ai:**

```bash
# Install fal CLI
pip install fal

# Login to fal
fal auth login

# Deploy using pyproject.toml
cd serverless
fal deploy sam-3d-stream
```

The app is defined in `pyproject.toml` under `[tool.fal.apps]`:
```toml
[tool.fal.apps]
sam-3d-stream = { auth = "shared", ref = "app.py::SAM3DStreamApp" }
```

After deployment, copy the endpoint ID and add it to your frontend `.env.local`.

### SAM-3D Submodule

The `sam-3d/` directory is a Git submodule pointing to a [forked SAM-3D Objects repository](https://github.com/rehan-remade/sam-3d-objects) with streaming callback support.

**Updating the submodule:**
```bash
git submodule update --remote sam-3d
```

---

## 🔐 Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FAL_API_KEY` | Your fal.ai API key |
| `NEXT_PUBLIC_FAL_ENDPOINT_ID` | Deployed SAM-3D endpoint ID |

Get your API key at [fal.ai/dashboard](https://fal.ai/dashboard)

---

## 📁 Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Main orchestrator, layout, state
│   ├── components/
│   │   ├── VoxelViewer.tsx   # 3D rendering (voxels, mesh, GLB)
│   │   ├── BottomToolbar.tsx # Chat-style input bar
│   │   ├── ViewCube.tsx      # Interactive camera cube
│   │   └── LogPanel.tsx      # Streaming logs drawer
│   ├── hooks/
│   │   └── useSAM3DStream.ts # SSE streaming logic
│   └── lib/
│       ├── types.ts          # TypeScript interfaces
│       ├── decoders.ts       # Base64 binary decoders
│       └── constants.ts      # Stage colors, defaults
└── public/
    └── logo.png              # Manifold logo
```

---

## 🛠️ Development

### Frontend Development

```bash
cd frontend
npm run dev
```

- Hot reload enabled
- View at `http://localhost:3000`
- Linting: `npm run lint`

### Testing the Streaming Endpoint

You can test the fal endpoint directly:

```bash
curl -X POST "https://fal.run/YOUR_ENDPOINT_ID/stream" \
  -H "Authorization: Key $FAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/image.jpg", "prompt": "car"}'
```

---

## 🎨 Technical Notes

### Coordinate Systems
- **SAM-3D**: Z-up coordinate system
- **Three.js**: Y-up coordinate system
- Mesh previews are converted; GLB files are native Y-up

### Object Placement
All models are positioned with their bottom on the grid (y=0)

### Camera Controls
- **OrbitControls**: Rotate and zoom (no panning)
- **ViewCube**: Click faces/edges/corners for preset views; drag to rotate

### Streaming Protocol
The endpoint uses SSE with these event stages:
1. `loading` → `preprocessing`
2. `geometry` (voxels during geometry diffusion)
3. `appearance` (colored voxels during appearance diffusion)
4. `mesh_preview` (vertex-colored mesh)
5. `glb_ready` (final textured model)
6. `complete` (file URLs)

---

## 🚢 Deployment

### Frontend (Vercel)

```bash
cd frontend
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Serverless Backend (fal.ai)

```bash
cd serverless
fal deploy sam-3d-stream
```

The endpoint runs on H100 GPUs with:
- 600s keep-alive
- 300s request timeout
- Auto-scaling (0 to 1 instances)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

This project builds on [SAM-3D Objects](https://github.com/pku-yuangroup/SAM-3D-Objects). Please refer to the original license in `sam-3d/LICENSE`.

---

## 🙏 Acknowledgments

- **[SAM-3D](https://github.com/pku-yuangroup/SAM-3D-Objects)** — The 3D reconstruction model
- **[fal.ai](https://fal.ai)** — Serverless GPU infrastructure
- **[Three.js](https://threejs.org)** & **[React Three Fiber](https://r3f.docs.pmnd.rs)** — 3D rendering

---

<p align="center">
  Built with ❤️ using <a href="https://fal.ai">fal.ai</a>
</p>

