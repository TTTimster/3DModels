// Wait for the viewer container to exist (Framer loads embeds async)
function waitForContainer() {
  const container = document.getElementById("viewer-container");
  if (!container) {
    requestAnimationFrame(waitForContainer);
    return;
  }
  initViewer(container);
}

waitForContainer();

function initViewer(container) {
  // Scene
  const scene = new THREE.Scene();

  // Camera (locked)
  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(2, 2, 3);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  // Renderer (adaptive to embed size)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Lighting
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  // HDR Environment
  new THREE.RGBELoader()
    .setDataType(THREE.UnsignedByteType)
    .load(
      "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr",
      function (texture) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envMap = pmrem.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        scene.environmentIntensity = 0.4;
        texture.dispose();
        pmrem.dispose();
      }
    );

  // Load GLB (absolute URL for Framer iframe + CORS safety)
  const loader = new THREE.GLTFLoader();
  let model = null;
  let mixer = null;
  let action = null;

  loader.load(
    "https://tttimster.github.io/3DModels/VanV2blend.glb",
    function (gltf) {
      model = gltf.scene;

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      scene.add(model);

      // Center model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // Animation setup
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        action = mixer.clipAction(gltf.animations[0]);
        action.play();
        action.paused = true; // start frozen
      }
    }
  );

  // Scroll‑scrubbing (0% → 50% = full animation)
  function updateScrollScrub() {
    if (!mixer || !action) return;

    const scrollMax = document.body.scrollHeight - window.innerHeight;
    const scrollY = window.scrollY;
    let t = scrollY / scrollMax;

    const animEnd = 0.5; // halfway down the page

    if (t <= animEnd) {
      const mapped = t / animEnd;
      const duration = action.getClip().duration;
      action.time = mapped * duration;
      mixer.update(0);
    } else {
      // Freeze at last frame
      const duration = action.getClip().duration;
      action.time = duration;
      mixer.update(0);
    }
  }

  window.addEventListener("scroll", updateScrollScrub);

  // Resize (adaptive to embed size)
  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
  }

  animate();
}

