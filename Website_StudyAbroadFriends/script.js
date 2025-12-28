mapboxgl.accessToken = 'pk.eyJ1IjoibWRhNDE2NjgiLCJhIjoiY21peWVzYzY5MDVmOTNlc2ViOThhZG93NSJ9.GC6nZB6eVgkZkxqAqsHipQ';

        // Aero the Assistant
        const aeroTips = {
            welcome: "Hi! I'm Aero, your study abroad assistant! 👋 Click on me anytime for tips!",
            hero: "Welcome! Create your factsheet to connect with students worldwide. Click 'Create Factsheet' to get started! ✈️",
            form: "Fill out your factsheet to join the community! Don't forget to upload a photo and select your destination. 📸",
            map: "Explore the map! Click on any marker to see a student's boarding pass and connect with them. 🌍",
            code: "Have an access code? Enter it to skip creating a new factsheet and go straight to the map! 🔑",
            boardingPass: "This is a digital boarding pass! You can download it as an image. Share it with friends! 🎫",
            firstMarker: "Great! You've created your factsheet. Click on markers to see other students' profiles! 👥"
        };

        let currentTip = null;
        let tipTimeout = null;

        function showAeroTip(tipKey, duration = 5000) {
            const speechBubble = document.getElementById('aeroSpeechBubble');
            const speechContent = document.getElementById('speechContent');
            
            if (aeroTips[tipKey]) {
                speechContent.textContent = aeroTips[tipKey];
                speechBubble.classList.add('show');
                currentTip = tipKey;
                
                if (tipTimeout) clearTimeout(tipTimeout);
                if (duration > 0) {
                    tipTimeout = setTimeout(() => {
                        hideAeroTip();
                    }, duration);
                }
            }
        }

        function hideAeroTip() {
            const speechBubble = document.getElementById('aeroSpeechBubble');
            speechBubble.classList.remove('show');
            currentTip = null;
            if (tipTimeout) {
                clearTimeout(tipTimeout);
                tipTimeout = null;
            }
        }

        function moveAeroToPosition(x, y) {
            const aeroContainer = document.getElementById('aeroContainer');
            aeroContainer.style.right = `${x}px`;
            aeroContainer.style.bottom = `${y}px`;
        }

        function flyAeroToElement(elementId, offsetX = 0, offsetY = 0) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            const x = window.innerWidth - rect.right - offsetX;
            const y = window.innerHeight - rect.bottom - offsetY;
            
            moveAeroToPosition(x, y);
        }

        // Make Aero clickable to show tips (set up on window load)
        function setupAeroClick() {
            const aeroImage = document.getElementById('aeroImage');
            if (aeroImage) {
                aeroImage.addEventListener('click', () => {
                    if (currentTip) {
                        hideAeroTip();
                    } else {
                        // Show context-appropriate tip
                        const heroSection = document.getElementById('heroSection');
                        const formContainer = document.getElementById('formContainer');
                        const map = document.getElementById('map');
                        
                        if (formContainer && formContainer.classList.contains('open')) {
                            showAeroTip('form');
                        } else if (map && map.classList.contains('interactive')) {
                            showAeroTip('map');
                        } else if (heroSection && !heroSection.classList.contains('hidden')) {
                            showAeroTip('hero');
                        } else {
                            showAeroTip('welcome');
                        }
                    }
                });
            }
        }

        // Generate a unique access code
        function generateAccessCode() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        // Check if user has an access code on page load
        function checkAccessCode() {
            const accessCode = localStorage.getItem('studyAbroadAccessCode');
            if (accessCode) {
                // User has a code, enable map and hide hero
                document.getElementById('map').classList.add('interactive');
                document.getElementById('heroSection').classList.add('hidden');
                document.getElementById('headerButtons').classList.add('visible');
                
                // Welcome back tip
                setTimeout(() => {
                    moveAeroToPosition(50, 100);
                    showAeroTip('map', 6000);
                }, 1000);
                
                return true;
            }
            return false;
        }

        // Function to enter access code manually
        function enterAccessCode() {
            const input = document.getElementById('accessCodeInput');
            const code = input.value.trim().toUpperCase();
            
            if (code.length === 8) {
                // Store the code and grant access
                localStorage.setItem('studyAbroadAccessCode', code);
                document.getElementById('map').classList.add('interactive');
                document.getElementById('heroSection').classList.add('hidden');
                document.getElementById('headerButtons').classList.add('visible');
                input.value = '';
                
                // Aero tip after code entry
                setTimeout(() => {
                    moveAeroToPosition(50, 100);
                    showAeroTip('map', 6000);
                }, 500);
            } else {
                alert('Please enter a valid 8-digit access code.');
            }
        }

        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v11',
            projection: 'globe',
            zoom: 2,
            center: [10, 30]
        });

        map.on('style.load', () => {
            map.setFog({
                'color': '#E8F8F5',
                'high-color': '#FDFCE8',
                'horizon-blend': 0.02,
                'space-color': '#FDFCE8',
                'star-intensity': 0
            });
        });

        const students = [
            { 
                name: "Lisa", 
                origin: "Munich, Germany",
                location: "Barcelona, Spain", 
                lat: 41.3851, 
                lng: 2.1734, 
                university: "Universitat de Barcelona", 
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=1",
                instagram: "lisa_barcelona",
                major: "Business Administration",
                languages: "German, English, Spanish",
                lookingFor: "Roommate & Activity Partners",
                about: "Hey! I'm Lisa from Germany, studying business in Barcelona. Would love to meet people who enjoy exploring the city and trying new restaurants!"
            },
            { 
                name: "Max", 
                origin: "Munich, Germany",
                location: "London, UK", 
                lat: 51.5074, 
                lng: -0.1278, 
                university: "King's College London", 
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=13",
                instagram: "max_london",
                major: "Computer Science",
                languages: "German, English",
                lookingFor: "Study Group & Friends",
                about: "Computer Science student from Munich. Looking forward to the London tech scene and meeting fellow students!"
            },
            { 
                name: "Sophie", 
                origin: "Lyon, France",
                location: "Paris, France", 
                lat: 48.8566, 
                lng: 2.3522, 
                university: "Sorbonne University", 
                semester: "SS 25", 
                img: "https://i.pravatar.cc/150?img=5",
                instagram: "sophie_paris",
                major: "Art History",
                languages: "French, English, Italian",
                lookingFor: "Cultural Exchange Partners",
                about: "Art history enthusiast ready to explore Paris! Let's visit museums and galleries together."
            },
            { 
                name: "Tom", 
                origin: "Berlin, Germany",
                location: "New York, USA", 
                lat: 40.7128, 
                lng: -74.0060, 
                university: "New York University", 
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=12",
                instagram: "tom_nyc",
                major: "Film Production",
                languages: "English, German",
                lookingFor: "Creative Collaborators",
                about: "Film student from Berlin. Excited to experience the NYC creative scene and collaborate on projects!"
            },
            { 
                name: "Emma", 
                origin: "London, UK",
                location: "Tokyo, Japan", 
                lat: 35.6762, 
                lng: 139.6503, 
                university: "Waseda University", 
                semester: "SS 25", 
                img: "https://i.pravatar.cc/150?img=9",
                instagram: "emma_tokyo",
                major: "International Relations",
                languages: "English, Japanese (learning), German",
                lookingFor: "Language Exchange & Friends",
                about: "Can't wait to explore Tokyo and improve my Japanese! Looking for language exchange partners and adventure buddies."
            },
            { 
                name: "Lukas", 
                origin: "Hamburg, Germany",
                location: "Sydney, Australia", 
                lat: -33.8688, 
                lng: 151.2093, 
                university: "UNSW Sydney", 
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=15",
                instagram: "lukas_sydney",
                major: "Marine Biology",
                languages: "German, English",
                lookingFor: "Sports & Adventure Partners",
                about: "Marine biology student heading to Sydney! Super excited about the beaches and water sports. Let's catch some waves!"
            },
            { 
                name: "Anna", 
                origin: "Cologne, Germany",
                location: "Madrid, Spain", 
                lat: 40.4168, 
                lng: -3.7038, 
                university: "Universidad Complutense de Madrid", 
                semester: "SS 25", 
                img: "https://i.pravatar.cc/150?img=24",
                instagram: "anna_madrid",
                major: "Spanish Literature",
                languages: "German, English, Spanish",
                lookingFor: "Language Practice & Cultural Activities",
                about: "Literature lover excited to immerse myself in Spanish culture. Let's practice Spanish together and explore Madrid!"
            },
            { 
                name: "Felix", 
                origin: "Hamburg, Germany",
                location: "Amsterdam, Netherlands", 
                lat: 52.3676, 
                lng: 4.9041, 
                university: "University of Amsterdam", 
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=33",
                instagram: "felix_amsterdam",
                major: "Economics",
                languages: "German, English, Dutch (learning)",
                lookingFor: "Nightlife & Sports Partners",
                about: "Economics student from Hamburg. Looking forward to the bike culture and nightlife in Amsterdam!"
            }
        ];

        // EXACTLY like the working version - simple marker creation
        students.forEach(student => {
            const el = document.createElement('div');
            el.className = 'student-marker';
            el.style.backgroundImage = `url('${student.img}')`;
            
            el.addEventListener('click', () => {
                openSidebar(student);
            });

            new mapboxgl.Marker(el)
                .setLngLat([student.lng, student.lat])
                .addTo(map);
        });

        function openSidebar(student) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('passOverlay');
            const content = document.getElementById('sidebarContent');
            
            // Aero tip for boarding pass
            setTimeout(() => {
                flyAeroToElement('sidebarWrapper', -20, 20);
                showAeroTip('boardingPass', 6000);
            }, 500);

            const originCode = student.origin.split(',')[0].substring(0, 3).toUpperCase();
            const cityCode = student.location.split(',')[0].substring(0, 3).toUpperCase();

            content.innerHTML = `
                <div class="pass-top">
                    <div class="pass-header-row">
                        <span>STUDY ABROAD FRIENDS</span>
                        <div class="pass-header-right">
                            <span>BOARDING PASS</span>
                            <img src="${student.img}" alt="${student.name}" class="pass-profile-image-inline">
                        </div>
                    </div>
                    <div class="flight-route">
                        <div>
                            <div class="pass-label" style="color:rgba(255,255,255,0.6)">From</div>
                            <div class="airport-code">${originCode}</div>
                            <div class="pass-label" style="color:rgba(255,255,255,0.8); margin-top: 5px; font-size: 11px;">${student.origin}</div>
                        </div>
                        <div class="plane-icon">✈️</div>
                        <div style="text-align: right;">
                            <div class="pass-label" style="color:rgba(255,255,255,0.6)">To</div>
                            <div class="airport-code">${cityCode}</div>
                            <div class="pass-label" style="color:rgba(255,255,255,0.8); margin-top: 5px; font-size: 11px;">${student.location}</div>
                        </div>
                    </div>
                </div>
                
                <div class="pass-mid">
                    <div>
                        <div class="pass-label">Passenger</div>
                        <div class="pass-value">${student.name}</div>
                    </div>
                    <div>
                        <div class="pass-label">Semester</div>
                        <div class="pass-value">${student.semester}</div>
                    </div>
                    <div>
                        <div class="pass-label">University</div>
                        <div class="pass-value">${student.university}</div>
                    </div>
                    <div>
                        <div class="pass-label">Major</div>
                        <div class="pass-value">${student.major}</div>
                    </div>
                    <div style="grid-column: span 2;">
                        <div class="pass-label">Languages</div>
                        <div class="pass-value" style="font-weight: 400; font-size: 13px;">${student.languages}</div>
                    </div>
                    <div style="grid-column: span 2;">
                        <div class="pass-label">Looking For</div>
                        <div class="pass-value" style="font-weight: 600; font-size: 13px; color: #DB7E70;">${student.lookingFor}</div>
                    </div>
                    <div style="grid-column: span 2;">
                        <div class="pass-label">Note from Passenger</div>
                        <div class="pass-value" style="font-weight: 400; font-size: 13px;">"${student.about}"</div>
                    </div>
                </div>

                <div class="pass-bottom">
                    <canvas class="barcode-canvas"></canvas>
                    <a href="https://instagram.com/${student.instagram}" target="_blank" class="btn-connect">
                        DM @${student.instagram.toUpperCase()}
                    </a>
                </div>
            `;

            // Draw barcode on canvas after HTML is inserted
            setTimeout(() => {
                drawBarcode();
            }, 100);

            document.getElementById('sidebarWrapper').classList.add('open');
            overlay.classList.add('visible');
        }

        function drawBarcode() {
            const canvas = document.querySelector('.barcode-canvas');
            if (!canvas) return;

            const container = canvas.parentElement;
            // Get the actual width, accounting for padding (25px on each side)
            const containerWidth = container.offsetWidth;
            const canvasWidth = containerWidth - 50; // Account for 25px padding on each side
            const height = 50;

            // Barcode pattern with varying stripe widths (in pixels)
            const pattern = [
                2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 4, 1,
                2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 4, 1,
                2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 4, 1,
                2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 4, 1,
                2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 4, 1
            ];

            // Calculate total barcode width
            const gap = 1;
            let barcodeWidth = 0;
            for (let i = 0; i < pattern.length; i++) {
                barcodeWidth += pattern[i] + gap;
            }
            barcodeWidth -= gap; // Remove last gap

            // Center the barcode within the canvas
            const startX = (canvasWidth - barcodeWidth) / 2;

            // Set canvas size (use device pixel ratio for crisp rendering)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvasWidth * dpr;
            canvas.height = height * dpr;
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = height + 'px';

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            
            ctx.fillStyle = '#333';
            ctx.globalAlpha = 0.8;

            let x = startX;
            for (let i = 0; i < pattern.length; i++) {
                const barWidth = pattern[i];
                ctx.fillRect(x, 0, barWidth, height);
                x += barWidth + gap;
            }
        }

        async function downloadBoardingPass() {
            const boardingPass = document.querySelector('.boarding-pass');
            if (!boardingPass) return;

            try {
                // Hide elements that shouldn't be in the download
                const profileImage = boardingPass.querySelector('.pass-profile-image-inline');
                const connectButton = boardingPass.querySelector('.btn-connect');
                
                const originalImageDisplay = profileImage ? profileImage.style.display : null;
                const originalButtonDisplay = connectButton ? connectButton.style.display : null;
                
                if (profileImage) profileImage.style.display = 'none';
                if (connectButton) connectButton.style.display = 'none';

                // Use html2canvas to capture the boarding pass
                const canvas = await html2canvas(boardingPass, {
                    backgroundColor: null,
                    scale: 2, // Higher quality
                    useCORS: true,
                    logging: false
                });

                // Restore original display states
                if (profileImage) profileImage.style.display = originalImageDisplay || '';
                if (connectButton) connectButton.style.display = originalButtonDisplay || '';

                // Convert canvas to blob and download
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `boarding-pass-${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/png');
            } catch (error) {
                console.error('Error downloading boarding pass:', error);
                alert('Failed to download boarding pass. Please try again.');
            }
        }

        function closeSidebar() {
            document.getElementById('sidebarWrapper').classList.remove('open');
            document.getElementById('passOverlay').classList.remove('visible');
        }

        function scrollToForm(e) {
            e.preventDefault();
            // Hide hero section when opening form
            document.getElementById('heroSection').classList.add('hidden');
            document.getElementById('formContainer').classList.add('open');
            document.getElementById('formOverlay').classList.add('visible');
            
            // Aero tip for form
            setTimeout(() => {
                flyAeroToElement('formContainer', -20, 20);
                showAeroTip('form', 6000);
            }, 500);
        }

        function closeForm() {
            document.getElementById('formContainer').classList.remove('open');
            document.getElementById('formOverlay').classList.remove('visible');
            
            // Show hero section again if map is not yet interactive (user hasn't created factsheet)
            const map = document.getElementById('map');
            if (!map.classList.contains('interactive')) {
                document.getElementById('heroSection').classList.remove('hidden');
            }
        }

        let uploadedImageData = null;
        let selectedLocationData = null;

        function handleImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    uploadedImageData = e.target.result;
                    document.getElementById('imagePreview').src = uploadedImageData;
                    document.getElementById('imagePreview').style.display = 'block';
                    document.getElementById('uploadPlaceholder').style.display = 'none';
                    document.getElementById('imageUploadArea').classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        }

        let searchTimeout;
        document.getElementById('locationSearch').addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value;
            
            if (query.length < 3) {
                document.getElementById('searchResults').innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&types=place,locality`
                    );
                    const data = await response.json();
                    
                    const resultsDiv = document.getElementById('searchResults');
                    resultsDiv.innerHTML = '';
                    
                    if (data.features && data.features.length > 0) {
                        data.features.forEach(feature => {
                            const div = document.createElement('div');
                            div.className = 'search-result-item';
                            div.textContent = feature.place_name;
                            div.onclick = () => selectLocation(feature);
                            resultsDiv.appendChild(div);
                        });
                    } else {
                        resultsDiv.innerHTML = '<div style="padding: 10px; color: #999;">No results found</div>';
                    }
                } catch (error) {
                    console.error('Geocoding error:', error);
                }
            }, 300);
        });

        function selectLocation(feature) {
            const placeName = feature.place_name;
            const parts = placeName.split(', ');
            const city = parts[0];
            const country = parts[parts.length - 1];
            
            selectedLocationData = {
                city: city,
                country: country,
                lat: feature.center[1],
                lng: feature.center[0],
                fullName: placeName
            };

            document.getElementById('destCity').value = city;
            document.getElementById('destCountry').value = country;
            document.getElementById('destLat').value = feature.center[1];
            document.getElementById('destLng').value = feature.center[0];
            
            document.getElementById('selectedLocation').textContent = `✓ Selected: ${placeName}`;
            document.getElementById('selectedLocation').style.display = 'block';
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('locationSearch').value = '';
        }

        function handleFormSubmit(e) {
            e.preventDefault();
            
            if (!uploadedImageData) {
                alert('Please upload a profile picture!');
                return;
            }
            
            if (!selectedLocationData) {
                alert('Please search and select your destination location!');
                return;
            }
            
            const formData = new FormData(e.target);
            const newStudent = {
                name: formData.get('name'),
                origin: `${formData.get('originCity')}, ${formData.get('originCountry')}`,
                location: `${selectedLocationData.city}, ${selectedLocationData.country}`,
                lat: parseFloat(selectedLocationData.lat),
                lng: parseFloat(selectedLocationData.lng),
                university: formData.get('university'),
                semester: formData.get('semester'),
                img: uploadedImageData,
                instagram: formData.get('instagram'),
                major: formData.get('major'),
                languages: formData.get('languages'),
                lookingFor: formData.get('lookingFor'),
                about: formData.get('about')
            };

            students.push(newStudent);
            
            // Use EXACT same marker creation as initial students
            const el = document.createElement('div');
            el.className = 'student-marker';
            el.style.backgroundImage = `url('${newStudent.img}')`;
            
            el.addEventListener('click', () => {
                openSidebar(newStudent);
            });

            new mapboxgl.Marker(el)
                .setLngLat([newStudent.lng, newStudent.lat])
                .addTo(map);
            
            e.target.reset();
            uploadedImageData = null;
            selectedLocationData = null;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('uploadPlaceholder').style.display = 'block';
            document.getElementById('imageUploadArea').classList.remove('has-image');
            document.getElementById('selectedLocation').style.display = 'none';
            
            closeForm();
            
            // Generate and store access code
            const accessCode = generateAccessCode();
            localStorage.setItem('studyAbroadAccessCode', accessCode);
            
            // Enable map interaction and hide hero section
            document.getElementById('map').classList.add('interactive');
            document.getElementById('heroSection').classList.add('hidden');
            document.getElementById('headerButtons').classList.add('visible');
            
            map.flyTo({
                center: [newStudent.lng, newStudent.lat],
                zoom: 10,
                duration: 2000
            });
            
            setTimeout(() => {
                alert(`🎉 Your factsheet has been added to the map!\n\nYour access code: ${accessCode}\n\nSave this code to access the map directly next time!`);
                
                // Aero tip after factsheet creation
                setTimeout(() => {
                    moveAeroToPosition(50, 100);
                    showAeroTip('firstMarker', 7000);
                }, 1000);
            }, 500);
            
            updateStats();
        }

        function updateStats() {
            const countries = new Set(students.map(s => s.location.split(',')[1].trim()));
            document.getElementById('student-count').textContent = students.length;
            document.getElementById('country-count').textContent = countries.size;
            document.getElementById('connection-count').textContent = Math.floor(students.length * 2.3);
        }


        window.addEventListener('load', () => {
            // Set up Aero click handler
            setupAeroClick();
            
            // Check for access code on page load
            const hasCode = checkAccessCode();
            
            // Set up Enter key for code input
            const codeInput = document.getElementById('accessCodeInput');
            if (codeInput) {
                codeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        enterAccessCode();
                    }
                });
            }
            
            // Show welcome tip if no access code
            if (!hasCode) {
                setTimeout(() => {
                    moveAeroToPosition(50, 100);
                    showAeroTip('welcome', 6000);
                }, 1500);
            }
            
            animateNumber('student-count', 127, 2000);
            animateNumber('country-count', 34, 2000);
            animateNumber('connection-count', 289, 2000);
        });

        function animateNumber(id, target, duration) {
            const element = document.getElementById(id);
            const start = 0;
            const increment = target / (duration / 16);
            let current = start;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    element.textContent = target;
                    clearInterval(timer);
                } else {
                    element.textContent = Math.floor(current);
                }
            }, 16);
        }