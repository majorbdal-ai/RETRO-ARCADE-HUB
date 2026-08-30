
function arcadeApp() {
    return {
        activeGame: null,
        currentScore: 0,
        highScore: localStorage.getItem('arcade_highscore') || 0,
        gameOver: false,
        gameInterval: null,
        canvas: null,
        ctx: null,

        launchGame(type) {
            this.activeGame = type;
            this.currentScore = 0;
            this.gameOver = false;
            setTimeout(() => {
                this.initCanvas();
                this.startGameEngine(type);
            }, 100);
        },

        stopGame() {
            if (this.gameInterval) clearInterval(this.gameInterval);
            this.activeGame = null;
        },

        restartGame() {
            if (this.gameInterval) clearInterval(this.gameInterval);
            this.currentScore = 0;
            this.gameOver = false;
            this.initCanvas();
            this.startGameEngine(this.activeGame);
        },

        gameTitle() {
            if (this.activeGame === 'shooter') return 'Cyber Space Combat';
            if (this.activeGame === 'snake') return 'Cyber Neon Snake';
            if (this.activeGame === 'breaker') return 'Brick Breaker 2026';
            return '';
        },

        initCanvas() {
            this.canvas = document.getElementById('gameCanvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
            }
        },

        startGameEngine(type) {
            if (type === 'shooter') this.runSpaceShooter();
            else if (type === 'snake') this.runSnake();
            else if (type === 'breaker') this.runBrickBreaker();
        },

        // --- 1. Space Shooter Engine ---
        runSpaceShooter() {
            let ctx = this.ctx;
            let ship = { x: 375, y: 420, w: 50, h: 30, speed: 7 };
            let bullets = [];
            let enemies = [];
            let keys = {};

            window.onkeydown = (e) => { keys[e.code] = true; };
            window.onkeyup = (e) => { keys[e.code] = false; };
            window.onkeypress = (e) => {
                if (e.code === 'Space') {
                    bullets.push({ x: ship.x + ship.w / 2 - 3, y: ship.y, w: 6, h: 12, speed: 10 });
                }
            };

            let frame = 0;
            this.gameInterval = setInterval(() => {
                if (this.gameOver) return;
                frame++;

                // Movement
                if (keys['ArrowLeft'] && ship.x > 0) ship.x -= ship.speed;
                if (keys['ArrowRight'] && ship.x < 800 - ship.w) ship.x += ship.speed;
                if (keys['Space'] && frame % 15 === 0) {
                    bullets.push({ x: ship.x + ship.w / 2 - 3, y: ship.y, w: 6, h: 12, speed: 10 });
                }

                // Spawn enemies
                if (frame % 40 === 0) {
                    enemies.push({ x: Math.random() * 750, y: -30, w: 40, h: 30, speed: 3 + Math.random() * 2 });
                }

                // Update bullets
                bullets.forEach(b => b.y -= b.speed);
                bullets = bullets.filter(b => b.y > 0);

                // Update enemies
                enemies.forEach(e => e.y += e.speed);
                
                // Collision detection
                bullets.forEach((b, bi) => {
                    enemies.forEach((e, ei) => {
                        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                            bullets.splice(bi, 1);
                            enemies.splice(ei, 1);
                            this.currentScore += 10;
                            if (this.currentScore > this.highScore) {
                                this.highScore = this.currentScore;
                                localStorage.setItem('arcade_highscore', this.highScore);
                            }
                        }
                    });
                });

                // Check game over
                enemies.forEach((e, ei) => {
                    if (e.y > 500) {
                        this.gameOver = true;
                    }
                    if (e.x < ship.x + ship.w && e.x + e.w > ship.x && e.y < ship.y + ship.h && e.y + e.h > ship.y) {
                        this.gameOver = true;
                    }
                });
                enemies = enemies.filter(e => e.y <= 500);

                // Render
                ctx.fillStyle = '#0B0E14';
                ctx.fillRect(0, 0, 800, 500);

                // Draw ship
                ctx.fillStyle = '#FF3B7C';
                ctx.fillRect(ship.x, ship.y + 10, ship.w, 20);
                ctx.fillRect(ship.x + 20, ship.y, 10, 15);

                // Draw bullets
                ctx.fillStyle = '#22D3EE';
                bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

                // Draw enemies
                ctx.fillStyle = '#A855F7';
                enemies.forEach(e => {
                    ctx.fillRect(e.x, e.y, e.w, e.h);
                });

            }, 1000 / 60);
        },

        // --- 2. Snake Engine ---
        runSnake() {
            let ctx = this.ctx;
            let snake = [{ x: 160, y: 160 }, { x: 140, y: 160 }, { x: 120, y: 160 }];
            let food = { x: 300, y: 300 };
            let dx = 20, dy = 0;
            let changingDirection = false;

            window.onkeydown = (e) => {
                if (changingDirection) return;
                if (e.code === 'ArrowLeft' && dx === 0) { dx = -20; dy = 0; changingDirection = true; }
                if (e.code === 'ArrowUp' && dy === 0) { dx = 0; dy = -20; changingDirection = true; }
                if (e.code === 'ArrowRight' && dx === 0) { dx = 20; dy = 0; changingDirection = true; }
                if (e.code === 'ArrowDown' && dy === 0) { dx = 0; dy = 20; changingDirection = true; }
            };

            const spawnFood = () => {
                food.x = Math.floor(Math.random() * 40) * 20;
                food.y = Math.floor(Math.random() * 25) * 20;
            };

            this.gameInterval = setInterval(() => {
                if (this.gameOver) return;
                changingDirection = false;

                let head = { x: snake[0].x + dx, y: snake[0].y + dy };

                // Wall collision
                if (head.x < 0 || head.x >= 800 || head.y < 0 || head.y >= 500) {
                    this.gameOver = true;
                    return;
                }

                // Self collision
                for (let i = 0; i < snake.length; i++) {
                    if (head.x === snake[i].x && head.y === snake[i].y) {
                        this.gameOver = true;
                        return;
                    }
                }

                snake.unshift(head);

                if (head.x === food.x && head.y === food.y) {
                    this.currentScore += 20;
                    if (this.currentScore > this.highScore) {
                        this.highScore = this.currentScore;
                        localStorage.setItem('arcade_highscore', this.highScore);
                    }
                    spawnFood();
                } else {
                    snake.pop();
                }

                // Render
                ctx.fillStyle = '#0B0E14';
                ctx.fillRect(0, 0, 800, 500);

                // Food
                ctx.fillStyle = '#FF3B7C';
                ctx.fillRect(food.x, food.y, 18, 18);

                // Snake
                snake.forEach((part, index) => {
                    ctx.fillStyle = index === 0 ? '#22D3EE' : '#3B82F6';
                    ctx.fillRect(part.x, part.y, 18, 18);
                });

            }, 100);
        },

        // --- 3. Brick Breaker Engine ---
        runBrickBreaker() {
            let ctx = this.ctx;
            let x = 400, y = 300, dx = 4, dy = -4;
            let paddleX = 350;
            let paddleWidth = 100, paddleHeight = 12;
            let rightPressed = false, leftPressed = false;

            let brickRowCount = 5, brickColumnCount = 10;
            let brickWidth = 70, brickHeight = 20, brickPadding = 10, brickOffsetTop = 40, brickOffsetLeft = 35;
            let bricks = [];

            for (let c = 0; c < brickColumnCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < brickRowCount; r++) {
                    bricks[c][r] = { x: 0, y: 0, status: 1 };
                }
            }

            window.onkeydown = (e) => {
                if (e.code === 'ArrowRight') rightPressed = true;
                else if (e.code === 'ArrowLeft') leftPressed = true;
            };
            window.onkeyup = (e) => {
                if (e.code === 'ArrowRight') rightPressed = false;
                else if (e.code === 'ArrowLeft') leftPressed = false;
            };

            this.gameInterval = setInterval(() => {
                if (this.gameOver) return;

                // Render background
                ctx.fillStyle = '#0B0E14';
                ctx.fillRect(0, 0, 800, 500);

                // Draw bricks
                for (let c = 0; c < brickColumnCount; c++) {
                    for (let r = 0; r < brickRowCount; r++) {
                        if (bricks[c][r].status === 1) {
                            let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                            let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                            bricks[c][r].x = brickX;
                            bricks[c][r].y = brickY;
                            ctx.fillStyle = r % 2 === 0 ? '#FF3B7C' : '#22D3EE';
                            ctx.fillRect(brickX, brickY, brickWidth, brickHeight);

                            // Collision detection
                            if (x > brickX && x < brickX + brickWidth && y > brickY && y < brickY + brickHeight) {
                                dy = -dy;
                                bricks[c][r].status = 0;
                                this.currentScore += 15;
                                if (this.currentScore > this.highScore) {
                                    this.highScore = this.currentScore;
                                    localStorage.setItem('arcade_highscore', this.highScore);
                                }
                            }
                        }
                    }
                }

                // Draw paddle
                ctx.fillStyle = '#F59E0B';
                ctx.fillRect(paddleX, 500 - paddleHeight - 10, paddleWidth, paddleHeight);

                // Draw ball
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.closePath();

                // Ball movement
                if (x + dx > 800 - 10 || x + dx < 10) dx = -dx;
                if (y + dy < 10) dy = -dy;
                else if (y + dy > 500 - 25) {
                    if (x > paddleX && x < paddleX + paddleWidth) {
                        dy = -dy;
                    } else {
                        this.gameOver = true;
                    }
                }

                x += dx;
                y += dy;

                if (rightPressed && paddleX < 800 - paddleWidth) paddleX += 7;
                else if (leftPressed && paddleX > 0) paddleX -= 7;

            }, 1000 / 60);
        }
    }
}
