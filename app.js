
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tank1HealthBar = document.getElementById('tank1-health');
const tank2HealthBar = document.getElementById('tank2-health');
const tank1HealthContainer = document.getElementById('tank1-health-container');
const tank2HealthContainer = document.getElementById('tank2-health-container');
const gameMessage = document.getElementById('game-message');
const restartButton = document.getElementById('restart-button');
const menuButton = document.getElementById('menu-button');


// Screens
const menuScreen = document.getElementById('menu-screen');
const controlsScreen = document.getElementById('controls-screen');
const gameScreen = document.getElementById('game-screen');

// Menu Buttons
const playButton = document.getElementById('play-button');
const controlsButton = document.getElementById('controls-button');
const backButton = document.getElementById('back-button');

// Game settings
const TANK_WIDTH = 40;
const TANK_HEIGHT = 50;
const GRID_SIZE = 50;
const DEFAULT_Y_POSITION = canvas.height / 2;

// Set canvas dimensions
function setCanvasDimensions() {
    canvas.width = Math.min(window.innerWidth * 0.8, 1000);
    canvas.height = Math.min(window.innerHeight * 0.7, 600);
    
    // Adjust game container height to accommodate health bars
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.style.height = (canvas.height + 100) + 'px';
    }
}

// Game state
let obstacles = [];
let bullets = [];
let explosions = [];
let healthPickups = [];
let gameOver = false;
let isPaused = false;
let gameLoopId = null;
let tank1, tank2;
let soundEnabled = true;

// Sound effects
const sounds = {
    shoot: null,
    explosion: null,
    pickup: null,
    menuClick: null,
    tankHit: null,
    gameStart: null,
    victory: null
};

// Initialize sounds
function initSounds() {
    // Create audio contexts for sounds (implementation left for you to add actual sounds)
    sounds.shoot = { play: () => {} };
    sounds.explosion = { play: () => {} };
    sounds.pickup = { play: () => {} };
    sounds.menuClick = { play: () => {} };
    sounds.tankHit = { play: () => {} };
    sounds.gameStart = { play: () => {} };
    sounds.victory = { play: () => {} };
}

// Initialize game
function initGame() {
    // Set canvas dimensions
    setCanvasDimensions();
    
    // Reset game state
    obstacles = [];
    bullets = [];
    explosions = [];
    healthPickups = [];
    gameOver = false;
    isPaused = false;

    // Hide UI elements
    gameMessage.style.display = "none";
    document.getElementById('game-buttons').style.display = "none";

    // Show health bars
    tank1HealthContainer.style.display = "flex";
    tank2HealthContainer.style.display = "flex";

    // Set DEFAULT_Y_POSITION to the vertical center of the canvas


    // Initialize tanks
    tank1 = {
        x: 50, // Start near the left edge
        y: DEFAULT_Y_POSITION,
        width: TANK_WIDTH,
        height: TANK_HEIGHT,
        speed: 4,
        rotation: 0, // Start facing to the right
        color: '#2ecc71',
        borderColor: '#145a32',
        flashCount: 0,
        health: 100,
        maxHealth: 100,
        shootCooldown: 0,
        maxCooldown: 15,
        barrelLength: 30,
        barrelWidth: 8,
        id: 1
    };

    tank2 = {
        x: canvas.width - 90, // Start near the right edge
        y: DEFAULT_Y_POSITION,
        width: TANK_WIDTH,
        height: TANK_HEIGHT,
        speed: 4,
        rotation: 180,
        color: '#e74c3c',
        borderColor: '#7b241c',
        flashCount: 0,
        health: 100,
        maxHealth: 100,
        shootCooldown: 0,
        maxCooldown: 15,
        barrelLength: 30,
        barrelWidth: 8,
        id: 2
    };

    createObstacles();
    spawnHealthPickup();
    updateHealthBars();
    
    // Start game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Create obstacles for the game map
function createObstacles() {
    const rows = Math.floor(canvas.height / GRID_SIZE);
    const cols = Math.floor(canvas.width / GRID_SIZE);
    
    // Keep edges of map clear
    const clearEdgeSize = 3;
    
    // Main cover blocks
    for (let i = 0; i < 8; i++) {
        let validPosition = false;
        let x, y;
        
        while (!validPosition) {
            x = clearEdgeSize + Math.floor(Math.random() * (cols - 2 * clearEdgeSize));
            y = clearEdgeSize + Math.floor(Math.random() * (rows - 2 * clearEdgeSize));
            
            // Check if position is clear from tanks
            const tank1Clear = Math.hypot((x * GRID_SIZE) - tank1.x, (y * GRID_SIZE) - tank1.y) > 150;
            const tank2Clear = Math.hypot((x * GRID_SIZE) - tank2.x, (y * GRID_SIZE) - tank2.y) > 150;
            
            validPosition = tank1Clear && tank2Clear && 
                !obstacles.some(o => Math.abs(o.x - x * GRID_SIZE) < GRID_SIZE && Math.abs(o.y - y * GRID_SIZE) < GRID_SIZE);
        }
        
        // Create a cluster of obstacles
        createObstacleCluster(x, y);
    }
}

// Create cluster of obstacles
function createObstacleCluster(startX, startY) {
    // Center obstacle
    obstacles.push({ 
        x: startX * GRID_SIZE, 
        y: startY * GRID_SIZE,
        width: GRID_SIZE,
        height: GRID_SIZE
    });
    
    // Random neighboring obstacles
    const directions = [
        {dx: 1, dy: 0}, {dx: -1, dy: 0},
        {dx: 0, dy: 1}, {dx: 0, dy: -1}
    ];
    
    directions.forEach(dir => {
        if (Math.random() < 0.6) {
            const nx = startX + dir.dx;
            const ny = startY + dir.dy;
            
            // Ensure obstacle is within canvas
            if (nx >= 0 && nx * GRID_SIZE < canvas.width - GRID_SIZE && 
                ny >= 0 && ny * GRID_SIZE < canvas.height - GRID_SIZE) {
                obstacles.push({ 
                    x: nx * GRID_SIZE, 
                    y: ny * GRID_SIZE,
                    width: GRID_SIZE,
                    height: GRID_SIZE
                });
            }
        }
    });
}

// Spawn health pickup at random empty grid position
function spawnHealthPickup() {
    if (healthPickups.length >= 3 || gameOver) return; // Limit number of health pickups
    
    const rows = Math.floor(canvas.height / GRID_SIZE);
    const cols = Math.floor(canvas.width / GRID_SIZE);
    
    let validPosition = false;
    let x, y;
    const healthPickupSize = 30; // Increased from 25 to 30
    
    // Try to find an empty position
    let attempts = 0;
    while (!validPosition && attempts < 200) {
        attempts++;
        x = Math.floor(Math.random() * cols);
        y = Math.floor(Math.random() * rows);
        
        const pickupX = x * GRID_SIZE + (GRID_SIZE - healthPickupSize) / 2;
        const pickupY = y * GRID_SIZE + (GRID_SIZE - healthPickupSize) / 2;
        
        // Check if this grid cell is empty (no obstacles)
        const cellIsEmpty = !obstacles.some(o => 
            o.x === x * GRID_SIZE && o.y === y * GRID_SIZE
        );
        
        // Check if it's not too close to tanks
        const tank1Clear = Math.hypot(pickupX - tank1.x, pickupY - tank1.y) > 100;
        const tank2Clear = Math.hypot(pickupX - tank2.x, pickupY - tank2.y) > 100;
        
        // Check if it's not too close to other pickups
        const otherPickupsClear = !healthPickups.some(p => 
            Math.hypot(pickupX - p.x, pickupY - p.y) < GRID_SIZE
        );
        
        validPosition = cellIsEmpty && tank1Clear && tank2Clear && otherPickupsClear;
    }
    
    if (validPosition) {
        healthPickups.push({
            x: x * GRID_SIZE + (GRID_SIZE - healthPickupSize) / 2,
            y: y * GRID_SIZE + (GRID_SIZE - healthPickupSize) / 2,
            width: healthPickupSize,
            height: healthPickupSize,
            healAmount: 25,
            pulse: 0
        });
    }
    
    // Schedule next health pickup
    setTimeout(spawnHealthPickup, 10000 + Math.random() * 5000);
}

// Draw grid and obstacles
function drawGrid() {
    // Draw grid lines
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw obstacles
    obstacles.forEach(obstacle => {
        // Fill with a solid color
        ctx.fillStyle = '#34495e'; // Uniform fill color
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Thick outline
        ctx.strokeStyle = '#2c3e50'; // Outline color
        ctx.lineWidth = 4;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
}
function drawGrid() {
    // Draw grid lines
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw obstacles
    obstacles.forEach(obstacle => {
        // Fill with a solid color
        ctx.fillStyle = '#34495e'; // Uniform fill color
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Thick outline
        ctx.strokeStyle = '#2c3e50'; // Outline color
        ctx.lineWidth = 4;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Draw inner square (slightly smaller)
        const innerPadding = 10; // Padding for the inner square
        ctx.fillStyle = '#2c3e50'; // Inner square color
        ctx.fillRect(obstacle.x + innerPadding, obstacle.y + innerPadding, 
                     obstacle.width - 2 * innerPadding, 
                     obstacle.height - 2 * innerPadding);
    });
}




// Draw health pickups
function drawHealthPickups() {
    healthPickups.forEach(pickup => {
        // Pulse effect
        pickup.pulse = (pickup.pulse + 0.05) % (2 * Math.PI);
        const pulseFactor = 1 + 0.1 * Math.sin(pickup.pulse);
        const size = pickup.width * pulseFactor;

        // Center the pickup position
        const x = pickup.x - (size - pickup.width) / 2;
        const y = pickup.y - (size - pickup.height) / 2;

        // Draw health pickup
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        
        // Outer circle (optional, if you want it)
        ctx.fillStyle = '#ecf0f1'; // Light gray for circle background
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Red cross
        ctx.fillStyle = '#e74c3c'; // Solid red
        
        // Horizontal bar
        ctx.fillRect(-size * 0.35, -size * 0.15, size * 0.7, size * 0.3);
        
        // Vertical bar
        ctx.fillRect(-size * 0.15, -size * 0.35, size * 0.3, size * 0.7);
        
        ctx.restore();
    });
}


// Draw a tank
function drawTank(tank) {
    ctx.save();
    
    // Translate to the tank's position and apply rotation
    ctx.translate(tank.x, tank.y);
    ctx.rotate((tank.rotation * Math.PI / 180) + 1.58);
    
    // Draw tank body
    if (tank.flashCount > 0) {
        // Flash when hit
        ctx.fillStyle = '#ffffff';
        tank.flashCount--;
    } else {
        ctx.fillStyle = tank.color;
    }
    
    // Main tank body (rounded rectangle)
    ctx.beginPath();
    const radius = 10;
    ctx.moveTo(-tank.width / 2 + radius, -tank.height / 2);
    ctx.lineTo(tank.width / 2 - radius, -tank.height / 2);
    ctx.arcTo(tank.width / 2, -tank.height / 2, tank.width / 2, -tank.height / 2 + radius, radius);
    ctx.lineTo(tank.width / 2, tank.height / 2 - radius);
    ctx.arcTo(tank.width / 2, tank.height / 2, tank.width / 2 - radius, tank.height / 2, radius);
    ctx.lineTo(-tank.width / 2 + radius, tank.height / 2);
    ctx.arcTo(-tank.width / 2, tank.height / 2, -tank.width / 2, tank.height / 2 - radius, radius);
    ctx.lineTo(-tank.width / 2, -tank.height / 2 + radius);
    ctx.arcTo(-tank.width / 2, -tank.height / 2, -tank.width / 2 + radius, -tank.height / 2, radius);
    ctx.closePath();
    ctx.fill();
    
    // Tank border
    ctx.strokeStyle = tank.borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Tank detail - treads
    ctx.fillStyle = '#333';
    ctx.fillRect(-tank.width / 2 - 5, -tank.height / 2, 5, tank.height);
    ctx.fillRect(tank.width / 2, -tank.height / 2, 5, tank.height);
    
    // Tank detail - hatch
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = tank.borderColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    // Draw tank barrel
    ctx.fillStyle = tank.color;
    ctx.fillRect(-tank.barrelWidth / 2, 0, tank.barrelWidth, -tank.barrelLength);
    ctx.strokeStyle = tank.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-tank.barrelWidth / 2, 0, tank.barrelWidth, -tank.barrelLength);
    
    // Draw cooldown indicator if applicable
    if (tank.shootCooldown > 0) {
        const cooldownPercentage = tank.shootCooldown / tank.maxCooldown;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Changed to transparent white
        ctx.fillRect(-tank.barrelWidth / 2, 0, tank.barrelWidth, -tank.barrelLength * (1 - cooldownPercentage));
    }
    
    ctx.restore();
}

// Draw a bullet
function drawBullet(bullet) {
    ctx.save();
    
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.rotation * Math.PI / 180) ;
    
    // Bullet trail
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-15, -5);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    
    // Bullet body
    ctx.globalAlpha = 1;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Bullet glow
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
}

// Draw explosion effect
function drawExplosion(explosion) {
    ctx.save();
    
    ctx.translate(explosion.x, explosion.y);
    
    // Draw outer explosion ring
    ctx.beginPath();
    ctx.arc(0, 0, explosion.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 165, 0, ${explosion.alpha})`;
    ctx.fill();
    
    // Draw inner explosion
    ctx.beginPath();
    ctx.arc(0, 0, explosion.radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 0, ${explosion.alpha})`;
    ctx.fill();
    
    // Draw center
    ctx.beginPath();
    ctx.arc(0, 0, explosion.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${explosion.alpha})`;
    ctx.fill();
    
    ctx.restore();
}

// Update health bars
function updateHealthBars() {
    tank1HealthBar.style.width = `${tank1.health}%`;
    tank2HealthBar.style.width = `${tank2.health}%`;
    
    // Change color based on health
    if (tank1.health > 50) {
        tank1HealthBar.style.backgroundColor = '#2ecc71';
    } else if (tank1.health > 25) {
        tank1HealthBar.style.backgroundColor = '#f39c12';
    } else {
        tank1HealthBar.style.backgroundColor = '#e74c3c';
    }
    
    if (tank2.health > 50) {
        tank2HealthBar.style.backgroundColor = '#e74c3c';
    } else if (tank2.health > 25) {
        tank2HealthBar.style.backgroundColor = '#f39c12';
    } else {
        tank2HealthBar.style.backgroundColor = '#c0392b';
    }
}

// Handle collision between two objects
function checkCollision(obj1, obj2) {
    // Adjust for tank rotation and position
    let obj1Left, obj1Right, obj1Top, obj1Bottom;
    let obj2Left, obj2Right, obj2Top, obj2Bottom;

    const collisionPadding = 2; // Adjust this value to make collision smaller

    if (obj1.radius) {
        // For bullets (circular)
        obj1Left = obj1.x - obj1.radius;
        obj1Right = obj1.x + obj1.radius;
        obj1Top = obj1.y - obj1.radius;
        obj1Bottom = obj1.y + obj1.radius;
    } else {
        // For tanks and obstacles (rectangular)
        if (obj1.rotation) {
            // If it's a tank, use simplified bounding box
            obj1Left = obj1.x - obj1.width / 2 + collisionPadding;
            obj1Right = obj1.x + obj1.width / 2 - collisionPadding;
            obj1Top = obj1.y - obj1.height / 2 + collisionPadding;
            obj1Bottom = obj1.y + obj1.height / 2 - collisionPadding;
        } else {
            // For obstacles or health pickups
            obj1Left = obj1.x + collisionPadding;
            obj1Right = obj1.x + obj1.width - collisionPadding;
            obj1Top = obj1.y + collisionPadding;
            obj1Bottom = obj1.y + obj1.height - collisionPadding;
        }
    }

    if (obj2.radius) {
        // For bullets (circular)
        obj2Left = obj2.x - obj2.radius;
        obj2Right = obj2.x + obj2.radius;
        obj2Top = obj2.y - obj2.radius;
        obj2Bottom = obj2.y + obj2.radius;
    } else {
        // For tanks and obstacles (rectangular)
        if (obj2.rotation) {
            // If it's a tank, use simplified bounding box
            obj2Left = obj2.x - obj2.width / 2 + collisionPadding;
            obj2Right = obj2.x + obj2.width / 2 - collisionPadding;
            obj2Top = obj2.y - obj2.height / 2 + collisionPadding;
            obj2Bottom = obj2.y + obj2.height / 2 - collisionPadding;
        } else {
            // For obstacles or health pickups
            obj2Left = obj2.x + collisionPadding;
            obj2Right = obj2.x + obj2.width - collisionPadding;
            obj2Top = obj2.y + collisionPadding;
            obj2Bottom = obj2.y + obj2.height - collisionPadding;
        }
    }

    return !(obj1Right < obj2Left || 
             obj1Left > obj2Right || 
             obj1Bottom < obj2Top || 
             obj1Top > obj2Bottom);
}


// Handle shooting a bullet
function shoot(tank) {
    if (tank.shootCooldown > 0) return;
    
    // Calculate bullet start position - should match the end of the barrel
    const radians = (tank.rotation * Math.PI) / 180;
    const barrelEndX = tank.x + Math.cos(radians) * tank.barrelLength;
    const barrelEndY = tank.y + Math.sin(radians) * tank.barrelLength;
    
    bullets.push({
        x: barrelEndX,
        y: barrelEndY,
        radius: 5,
        speed: 10,
        rotation: tank.rotation, // Keep the bullet's rotation same as tank's
        color: tank.color,
        tankId: tank.id
    });
    
    // Apply cooldown
    tank.shootCooldown = tank.maxCooldown;
    
    // Play sound
    if (soundEnabled) {
        sounds.shoot.play();
    }
}



// Create explosion effect
function createExplosion(x, y, size = 1) {
    explosions.push({
        x: x,
        y: y,
        radius: 20 * size,
        alpha: 1,
        decreaseRate: 0.05
    });
    
    // Play sound
    if (soundEnabled) {
        sounds.explosion.play();
    }
}

// Handle tank movement
// Handle tank movement
// Initialize tanks


// Handle tank movement
function moveTank(tank, direction) {
    const radians = tank.rotation * Math.PI / 180;
    let moveX, moveY;
    
    // Calculate movement vector
    if (direction === 'forward') {
        moveX = Math.cos(radians) * tank.speed;
        moveY = Math.sin(radians) * tank.speed;
    } else {
        moveX = -Math.cos(radians) * tank.speed;
        moveY = -Math.sin(radians) * tank.speed;
    }
    
    // Try the full movement first
    let newX = tank.x + moveX;
    let newY = tank.y + moveY;
    
    // Create temporary tank object for collision checking
    const tempTank = { 
        x: newX, 
        y: newY, 
        width: tank.width, 
        height: tank.height,
        rotation: tank.rotation
    };
    
    // Check boundaries
    const halfWidth = tank.width / 2;
    const halfHeight = tank.height / 2;
    let boundaryCollision = false;
    
    // Horizontal boundary check
    if (newX - halfWidth < 0) {
        newX = halfWidth;
        boundaryCollision = true;
    } else if (newX + halfWidth > canvas.width) {
        newX = canvas.width - halfWidth;
        boundaryCollision = true;
    }
    
    // Vertical boundary check
    if (newY - halfHeight < 0) {
        newY = halfHeight;
        boundaryCollision = true;
    } else if (newY + halfHeight > canvas.height) {
        newY = canvas.height - halfHeight;
        boundaryCollision = true;
    }
    
    // Update temp tank position after boundary checks
    tempTank.x = newX;
    tempTank.y = newY;
    
    // Check collisions with obstacles
    let obstacleCollision = false;
    for (const obstacle of obstacles) {
        if (checkCollision(tempTank, obstacle)) {
            obstacleCollision = true;
            break;
        }
    }
    
    // Check collision with other tank
    const otherTank = tank.id === 1 ? tank2 : tank1;
    let tankCollision = checkCollision(tempTank, otherTank);
    
    // If there's a collision with obstacle or tank, try sliding
    if (obstacleCollision || tankCollision) {
        // Try moving only horizontally
        tempTank.x = tank.x + moveX;
        tempTank.y = tank.y;
        
        let horizontalClear = true;
        
        // Check if horizontal movement is clear of obstacles
        for (const obstacle of obstacles) {
            if (checkCollision(tempTank, obstacle)) {
                horizontalClear = false;
                break;
            }
        }
        
        // Check if horizontal movement is clear of the other tank
        if (horizontalClear && checkCollision(tempTank, otherTank)) {
            horizontalClear = false;
        }
        
        // Check if horizontal movement is within boundaries
        if (horizontalClear && (tempTank.x - halfWidth < 0 || tempTank.x + halfWidth > canvas.width)) {
            horizontalClear = false;
        }
        
        // Try moving only vertically
        tempTank.x = tank.x;
        tempTank.y = tank.y + moveY;
        
        let verticalClear = true;
        
        // Check if vertical movement is clear of obstacles
        for (const obstacle of obstacles) {
            if (checkCollision(tempTank, obstacle)) {
                verticalClear = false;
                break;
            }
        }
        
        // Check if vertical movement is clear of the other tank
        if (verticalClear && checkCollision(tempTank, otherTank)) {
            verticalClear = false;
        }
        
        // Check if vertical movement is within boundaries
        if (verticalClear && (tempTank.y - halfHeight < 0 || tempTank.y + halfHeight > canvas.height)) {
            verticalClear = false;
        }
        
        // Apply movement based on what's clear
        if (horizontalClear) {
            tank.x += moveX;
        }
        
        if (verticalClear) {
            tank.y += moveY;
        }
        
        // If we hit something, add a small bounce/recoil effect
        if (!horizontalClear && !verticalClear) {
            // Small recoil in the opposite direction
            const recoilDistance = 1;
            const recoilX = tank.x - (moveX > 0 ? recoilDistance : -recoilDistance);
            const recoilY = tank.y - (moveY > 0 ? recoilDistance : -recoilDistance);
            
            // Check if recoil position is valid
            const recoilTank = {
                x: recoilX,
                y: recoilY,
                width: tank.width,
                height: tank.height,
                rotation: tank.rotation
            };
            
            let recoilValid = true;
            
            // Check obstacles
            for (const obstacle of obstacles) {
                if (checkCollision(recoilTank, obstacle)) {
                    recoilValid = false;
                    break;
                }
            }
            
            // Check other tank
            if (recoilValid && checkCollision(recoilTank, otherTank)) {
                recoilValid = false;
            }
            
            // Apply recoil if valid
            if (recoilValid) {
                tank.x = recoilX;
                tank.y = recoilY;
            }
        }
    } else if (boundaryCollision) {
        // If we only hit the boundary, just use the boundary-corrected position
        tank.x = newX;
        tank.y = newY;
    } else {
        // No collision at all, so move normally
        tank.x = newX;
        tank.y = newY;
    }
}


// Rotate tank
function rotateTank(tank, direction) {
    if (direction === 'left') {
        tank.rotation -= 3;
    } else {
        tank.rotation += 3;
    }
    
    // Normalize rotation to 0-360
    if (tank.rotation < 0) tank.rotation += 360;
    if (tank.rotation >= 360) tank.rotation -= 360;
}

// End game
function endGame(winnerTank) {
    gameOver = true;
    
    gameMessage.style.display = "block";
    gameMessage.innerHTML = `<span style="color: ${winnerTank.color}">PLAYER ${winnerTank.id} WINS!</span>`;
    document.getElementById('game-buttons').style.display = "flex";
    
    // Play victory sound
    if (soundEnabled) {
        sounds.victory.play();
    }
}

// Handle input
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Prevent page scrolling
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Main game loop
function gameLoop() {
    if (gameOver || isPaused) {
        gameLoopId = requestAnimationFrame(gameLoop);
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid and obstacles
    drawGrid();
    
    // Draw health pickups
    drawHealthPickups();
    
    // Handle tank 1 input
    if (keys['KeyW']) moveTank(tank1, 'forward');
    if (keys['KeyS']) moveTank(tank1, 'backward');
    if (keys['KeyA']) rotateTank(tank1, 'left');
    if (keys['KeyD']) rotateTank(tank1, 'right');
    if (keys['Space']) shoot(tank1);
    
    // Handle tank 2 input
    if (keys['ArrowUp']) moveTank(tank2, 'forward');
    if (keys['ArrowDown']) moveTank(tank2, 'backward');
    if (keys['ArrowLeft']) rotateTank(tank2, 'left');
    if (keys['ArrowRight']) rotateTank(tank2, 'right');
    if (keys['Enter']) shoot(tank2);
    
    // Update bullets
// Update bullets
for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const radians = (bullet.rotation * Math.PI) / 180;
    
    // Move bullet in the direction of the tank's rotation
    bullet.x += Math.cos(radians) * bullet.speed;
    bullet.y += Math.sin(radians) * bullet.speed;
    
    // Check if bullet is out of bounds
    if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
        bullets.splice(i, 1);
        continue;
    }
    
    // Check collision with obstacles
    let hitObstacle = false;
    for (let j = 0; j < obstacles.length; j++) {
        if (checkCollision(bullet, obstacles[j])) {
            createExplosion(bullet.x, bullet.y, 0.5);
            bullets.splice(i, 1);
            hitObstacle = true;
            break;
        }
    }
    
    if (hitObstacle) continue;
    
    // Check collision with tanks
    const tank1Hit = bullet.tankId !== 1 && checkCollision(bullet, tank1);
    const tank2Hit = bullet.tankId !== 2 && checkCollision(bullet, tank2);
    
    if (tank1Hit) {
        tank1.health -= 10;
        tank1.flashCount = 5;
        updateHealthBars();
        createExplosion(bullet.x, bullet.y);
        bullets.splice(i, 1);
        
        if (soundEnabled) {
            sounds.tankHit.play();
        }
        
        if (tank1.health <= 0) {
            endGame(tank2);
        }
    }
    else if (tank2Hit) {
        tank2.health -= 10;
        tank2.flashCount = 5;
        updateHealthBars();
        createExplosion(bullet.x, bullet.y);
        bullets.splice(i, 1);
        
        if (soundEnabled) {
            sounds.tankHit.play();
        }
        
        if (tank2.health <= 0) {
            endGame(tank1);
        }
    }
}

    
    // Update health pickups
    for (let i = healthPickups.length - 1; i >= 0; i--) {
        const pickup = healthPickups[i];
        
        // Check if tank 1 picked up health
        if (checkCollision(tank1, pickup)) {
            tank1.health = Math.min(tank1.maxHealth, tank1.health + pickup.healAmount);
            updateHealthBars();
            healthPickups.splice(i, 1);
            
            if (soundEnabled) {
                sounds.pickup.play();
            }
            continue;
        }
        
        // Check if tank 2 picked up health
        if (checkCollision(tank2, pickup)) {
            tank2.health = Math.min(tank2.maxHealth, tank2.health + pickup.healAmount);
            updateHealthBars();
            healthPickups.splice(i, 1);
            
            if (soundEnabled) {
                sounds.pickup.play();
            }
        }
    }
    
    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].alpha -= explosions[i].decreaseRate;
        if (explosions[i].alpha <= 0) {
            explosions.splice(i, 1);
        }
    }
    
    // Update cooldowns
    if (tank1.shootCooldown > 0) tank1.shootCooldown--;
    if (tank2.shootCooldown > 0) tank2.shootCooldown--;
    
    // Draw tanks
    drawTank(tank1);
    drawTank(tank2);
    
    // Draw bullets
    bullets.forEach(drawBullet);
    
    // Draw explosions
    explosions.forEach(drawExplosion);
    
    // Continue game loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Toggle pause


// Show menu screen
function showMenuScreen() {
    menuScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    controlsScreen.classList.add('hidden');
}

// Show game screen
function showGameScreen() {
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    controlsScreen.classList.add('hidden');
    
    initGame();
}

// Show controls screen
function showControlsScreen() {
    menuScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    controlsScreen.classList.remove('hidden');
}

// Event listeners
window.addEventListener('resize', setCanvasDimensions);

playButton.addEventListener('click', () => {
    if (soundEnabled) sounds.menuClick.play();
    showGameScreen();
});

controlsButton.addEventListener('click', () => {
    if (soundEnabled) sounds.menuClick.play();
    showControlsScreen();
});

backButton.addEventListener('click', () => {
    if (soundEnabled) sounds.menuClick.play();
    showMenuScreen();
});

restartButton.addEventListener('click', () => {
    if (soundEnabled) sounds.menuClick.play();
    initGame();
});

menuButton.addEventListener('click', () => {
    if (soundEnabled) sounds.menuClick.play();
    showMenuScreen();
});


// Keyboard shortcut for pause

// Initialize the game
initSounds();
showMenuScreen();

