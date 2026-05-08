function waitForContainer() {
  const container = document.getElementById("viewer-container");
  if (!container) {
    setTimeout(waitForContainer, 50);
    return;
  }
  startViewer(container);
}
waitForContainer();

function startViewer(container) {
  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(2, 2, 3);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Controls (rotate + zoom allowed, but no auto-rotation)
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.target.set(0, 0, 0);

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

  // Load GLB
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

  // Scroll‑scrubbing
  function updateScrollScrub() {
    if (!mixer || !action) return;

    const scrollMax = document.body.scrollHeight - window.innerHeight;
    const t = scrollMax > 0 ? window.scrollY / scrollMax : 0;

    const duration = action.getClip().duration;
    action.time = t * duration;
    mixer.update(0); // force update
  }

  window.addEventListener("scroll", updateScrollScrub);

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

