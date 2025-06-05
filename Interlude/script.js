



document.addEventListener("DOMContentLoaded", () => {
  const texts = [
    "Schüttele den Blossom-Tree",
    "Die Blüten dieses Baumes enthalten Achtsamkeits-Omikjuis",
    "Auf jedem Omikuji findest du einen Impuls zum Innehalten",
    "Dieses ist für DICH!"
    
  ];


const tree = document.createElement("img");
tree.src = "images/blossom-tree.png";
tree.id = "blossom-tree";
tree.alt = "Blossom Tree";
document.body.appendChild(tree);



//SAKURA ANIMATION
const canvas = document.getElementById('sakura-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const initialPetalCount = 1500;
const reducedPetalCount = 30;
let targetPetalCount = initialPetalCount;
const images = [];


// Lade Blütenbilder
const blossomSources = ['images/cherryblossoms/blossom1.png', 'images/cherryblossoms/blossom2.png', 'images/cherryblossoms/blossom3.png', 'images/cherryblossoms/blossom4.png', 'images/cherryblossoms/blossom5.png'];

for (let src of blossomSources) {
  const img = new Image();
  img.src = src;
  images.push(img);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

class Petal {
  constructor() {
    this.reset();
    this.fading = false; // neu: für den Fade-Out-Status
  }

  reset() {
    this.x = random(0, width);
    this.y = random(-height, 0);
    this.radius = random(6, 12);
    this.opacity = random(0.3, 0.8);
    this.speed = random(0.2, 0.7);
    this.swing = random(0.5, 1.2);
    this.baseAngle = random(0, 2 * Math.PI);
    this.type = Math.random() < 0.6 ? 'ellipse' : 'image';
    this.image = this.type === 'image' ? images[Math.floor(Math.random() * images.length)] : null;
    this.fading = false;
  }

update(wind) {
  // Immer normale Bewegung
  this.y += this.speed;
  this.x += Math.sin(this.baseAngle) * this.swing + wind;
  this.baseAngle += 0.01;

  // Falls im Fade-Modus → nur die Transparenz reduzieren
  if (this.fading) {
    this.opacity -= 0.001; // Langsames Ausfaden (z.B. 0.003 für sehr sanft)

    if (this.opacity < 0) this.opacity = 0;
  }

  // Reset nur, wenn nicht im Fading
  if (this.y > height + 10 || this.x > width + 20 || this.x < -20) {
    if (!this.fading) {
      this.reset();
      this.y = -10;
    }
  }
}

  draw() {
    if (this.opacity <= 0) return; // Nicht mehr zeichnen, wenn unsichtbar

    if (this.type === 'ellipse') {
      ctx.beginPath();
      ctx.fillStyle = `rgba(247, 214, 224, ${this.opacity})`;
      ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.6, this.baseAngle, 0, 2 * Math.PI);
      ctx.fill();
    } else if (this.image && this.image.complete) {
      const size = this.radius * 2.5;
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.baseAngle);
      ctx.drawImage(this.image, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}

function createPetals(count) {
  petals = [];
  for (let i = 0; i < count; i++) {
    petals.push(new Petal());
  }
}
let petals = [];
createPetals(initialPetalCount); // Initial viele Blüten

// Wind
let wind = 0;
let windTarget = 0;

function updateWind() {
  windTarget = random(-0.3, 0.3);
  setTimeout(updateWind, random(3000, 7000));
}

updateWind();

function animate() {
  ctx.clearRect(0, 0, width, height);
  wind += (windTarget - wind) * 0.01;

  for (let i = petals.length - 1; i >= 0; i--) {
    const petal = petals[i];
    petal.update(wind);
    petal.draw();

    // Entferne Blüte, wenn sie vollständig ausgefadet ist
    if (petal.opacity <= 0) {
      petals.splice(i, 1);
    }
  }

  // Blüten ergänzen, falls Ziel größer ist
  while (petals.length < targetPetalCount) {
    petals.push(new Petal());
  }

  requestAnimationFrame(animate);
}

Promise.all(images.map(img => {
  return new Promise(resolve => {
    img.onload = resolve;
  });
})).then(() => {
  animate();
});

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});








  
  let currentIndex = 0;
  let started = false;
  let mindfulnessPrompt = ""; // Variable für den achtsamen Prompt

  const textElement = document.getElementById("text");
  const questionContainer = document.getElementById("question-container");
  const questionText = document.getElementById("question-text");
  const buttonGroup = document.getElementById("button-group");
  const userChoice = document.getElementById("user-choice");

  // Funktion, die einen zufälligen Prompt für die Kombination auswählt
function displayMindfulnessPrompt(firstAnswer, secondAnswer) {
  const key = `${firstAnswer}|${secondAnswer}`;
  const entries = videoMapping[key];

  if (entries && entries.length > 0) {
    // Zufällige Kombination aus Video + passendem Prompt auswählen
    const { video, prompt } = entries[Math.floor(Math.random() * entries.length)];

    const videoElement = document.createElement("video");
    videoElement.src = video;
    videoElement.className = "fullscreen-video";
    videoElement.autoplay = true;
    videoElement.muted = false;
    document.body.appendChild(videoElement);

    setTimeout(() => {
      videoElement.classList.add("show");

      videoElement.onended = () => {
        videoElement.classList.remove("show");
        videoElement.remove();

        // Achtsamer Prompt anzeigen
        const promptElement = document.createElement("div");
        promptElement.textContent = prompt;
        promptElement.className = "mindfulness-prompt";
        document.body.appendChild(promptElement);

        setTimeout(() => {
          promptElement.classList.add("fade-in");
        }, 500);

        setTimeout(() => {
          promptElement.classList.add("fade-out");

          setTimeout(() => {
            promptElement.remove();

            const gifElement = document.createElement("img");
            gifElement.src = "animat-printer-color.gif";
            gifElement.className = "centered-gif";
            document.body.appendChild(gifElement);

            setTimeout(() => {
              gifElement.remove();
              showReminderText();
            }, 10000);
          }, 1000);
        }, 10000);
      };
    }, 500);
  }
}




  function showNextText() {
    if (currentIndex >= texts.length - 1) {
      textElement.classList.add("hidden");

      setTimeout(() => {
        textElement.style.display = "none";
        document.body.style.backgroundColor = "#191919"; // Hintergrund färben
        document.getElementById("blossom-tree").style.opacity = "0"; // ← Baum langsam ausblenden 
        // Verzögert neue Frage einblenden
        setTimeout(() => {
          questionContainer.classList.add("show");
        }, 1500); // Wartezeit passend zur transition im CSS
      }, 1000);

      return;
    }

    textElement.classList.add("hidden");

    setTimeout(() => {
      currentIndex++;
      textElement.textContent = texts[currentIndex];
      textElement.classList.remove("hidden");

      setTimeout(() => {
        textElement.classList.add("hidden");
        setTimeout(showNextText, 0);
      }, 3000);
    }, 1000);
  }

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !started) {
    started = true;
    targetPetalCount = reducedPetalCount;

    // Fade-Out der überschüssigen Blüten starten
    for (let i = reducedPetalCount; i < petals.length; i++) {
      petals[i].fading = true;
    }

    showNextText();
  }
});






  let firstAnswer = "";
  let secondQuestionShown = false;

  buttonGroup.addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") {
      const answer = event.target.textContent;

      if (!secondQuestionShown) {
        // Speichere erste Antwort und zeige sie unten links
        firstAnswer = answer;
        userChoice.textContent = `Gefühl: ${firstAnswer}`;
        userChoice.classList.remove("hidden");
        userChoice.classList.add("show");

        // Zeige neue Frage + Buttons
        questionText.textContent = "Was wünschst du dir gerade?";
        buttonGroup.innerHTML = `
          <button>Inspiration</button>
          <button>Entspannung</button>
          <button>Klarheit</button>
          <button>Verbindung</button>
          <button>Ruhe</button>
        `;
        secondQuestionShown = true;
      } else {
        // Zweite Antwort auch anzeigen
        userChoice.textContent = `Gefühl: ${firstAnswer} | Wunsch: ${answer}`;

        // Frage + Buttons ausfaden
        questionContainer.classList.add("fade-out");
        questionText.classList.add("fade-out");
        buttonGroup.classList.add("fade-out");

        // Warte, bis das Ausfaden abgeschlossen ist
        setTimeout(() => {
          questionContainer.style.display = "none"; // Verstecke sie endgültig

          // Text "Dieser Zettel ist für DICH!" einblenden
          const message = document.createElement("div");
          message.textContent = "Dein Moment wird vorbereitet...";
          message.className = "final-message";
          document.body.appendChild(message);

          // Einfaden durch kurze Verzögerung aktivieren
          setTimeout(() => {
            message.style.opacity = "1";

            // Nach 3 Sekunden langsam ausfaden
            setTimeout(() => {
              message.classList.add("fade-out");

              // Dann: Mindfulness Prompt anzeigen
              setTimeout(() => {
                message.remove(); // Entferne den Text

                // Mindfulness-Prompt nach dem Ausfaden anzeigen
                displayMindfulnessPrompt(firstAnswer, answer);

              }, 1000); // Wartezeit für Ausfaden des Texts

            }, 3000); // Dauer der Anzeige von "Dieser Zettel ist für DICH!"

          }, 50); // Start-Einfade-Delay für Text

        }, 1000); // Dauer des Ausfadens der Buttons
      }
    }
  });




function showReminderText() {
  const reminder = document.createElement("div");
  reminder.textContent = "Wenn du diese Blüte wieder findest: Erinnere dich an diesen Moment";
  reminder.className = "reminder-text";
  document.body.appendChild(reminder);

  setTimeout(() => {
    reminder.classList.add("fade-in");
  }, 100);

  setTimeout(() => {
    reminder.classList.remove("fade-in");
    reminder.classList.add("fade-out");
  }, 3100);

  setTimeout(() => {
    reminder.remove();
    location.reload(); // ← ersetzt alles, wie bei echtem Neustart; // <== Anwendung nach Reminder zurücksetzen
  }, 10000);
}




});






