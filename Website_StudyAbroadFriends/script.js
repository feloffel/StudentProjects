mapboxgl.accessToken = 'pk.eyJ1IjoibWRhNDE2NjgiLCJhIjoiY21peWVzYzY5MDVmOTNlc2ViOThhZG93NSJ9.GC6nZB6eVgkZkxqAqsHipQ';

        // Aero the Assistant
        const aeroTips = {
            welcome: "Hi! I'm Aero, your study abroad assistant! 👋 Click on me anytime for tips!",
            hero: "Welcome! Create your factsheet to connect with students worldwide. Click 'Check-In' to get started! ✈️",
            form: "Fill out your factsheet to join the community! Don't forget to upload a photo and select your destination. 📸",
            map: "Explore the map! Click on any marker to see a student's boarding pass and connect with them. 🌍",
            code: "Have an access code? Enter it to skip creating a new factsheet and go straight to the map! 🔑",
            boardingPass: "This is a digital boarding pass! You can download it as an image. Share it with friends! 🎫",
            firstMarker: "Great! You've created your factsheet. Click on markers to see other students' profiles! 👥",
            filter: "Use the filter to find students by their status! Currently abroad, about to go, or flight attendants who've returned and will happily answer all of your questions!! 🔍",
            search: "Search for any city or place to fly there on the map! Perfect for finding students in specific locations! 🗺️"
        };

        let currentTip = null;
        let tipTimeout = null;
        let positionMonitorInterval = null;

        // Update speech bubble position based on Aero's current position
        function updateSpeechBubblePosition() {
            const speechBubble = document.getElementById('aeroSpeechBubble');
            const aeroContainer = document.getElementById('aeroContainer');
            
            // Only update if speech bubble is currently showing
            if (!speechBubble.classList.contains('show')) {
                return;
            }
            
            // Check Aero's position relative to viewport
            const aeroRect = aeroContainer.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const aeroCenterY = aeroRect.top + (aeroRect.height / 2);
            
            // If Aero is in the upper half of the viewport, position bubble below
            if (aeroCenterY < viewportHeight / 2) {
                speechBubble.classList.add('below');
                speechBubble.classList.remove('above');
            } else {
                // Aero is in lower half, position bubble above (default)
                speechBubble.classList.add('above');
                speechBubble.classList.remove('below');
            }
        }

        // Start monitoring Aero's position in real-time
        function startPositionMonitoring() {
            // Clear any existing interval
            if (positionMonitorInterval) {
                clearInterval(positionMonitorInterval);
            }
            
            // Monitor position every 50ms for smooth updates
            positionMonitorInterval = setInterval(() => {
                updateSpeechBubblePosition();
            }, 50);
        }

        // Stop monitoring Aero's position
        function stopPositionMonitoring() {
            if (positionMonitorInterval) {
                clearInterval(positionMonitorInterval);
                positionMonitorInterval = null;
            }
        }

        function showAeroTip(tipKey, duration = 20000) {
            const speechBubble = document.getElementById('aeroSpeechBubble');
            const speechContent = document.getElementById('speechContent');
            
            if (aeroTips[tipKey]) {
                speechContent.textContent = aeroTips[tipKey];
                
                // Update position based on Aero's current location
                updateSpeechBubblePosition();
                
                // Start monitoring position in real-time
                startPositionMonitoring();
                
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
            
            // Stop monitoring position when tip is hidden
            stopPositionMonitoring();
            
            if (tipTimeout) {
                clearTimeout(tipTimeout);
                tipTimeout = null;
            }
        }

        function moveAeroToPosition(x, y) {
            const aeroContainer = document.getElementById('aeroContainer');
            
            // Move Aero to new position
            aeroContainer.style.right = `${x}px`;
            aeroContainer.style.bottom = `${y}px`;
            
            // Position will be updated in real-time by the monitoring interval if speech bubble is showing
        }

        function flyAeroToElement(elementId, offsetX = 0, offsetY = 0) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            const x = window.innerWidth - rect.right - offsetX;
            const y = window.innerHeight - rect.bottom - offsetY;
            
            moveAeroToPosition(x, y);
        }

        function flyAeroToLeftOfElement(elementId, offsetX = 0, offsetY = 0) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            // Position to the left of the element: calculate from left edge, add offset, then convert to right-based positioning
            const x = window.innerWidth - rect.left + offsetX;
            const y = window.innerHeight - rect.bottom - offsetY;
            
            moveAeroToPosition(x, y);
        }

        function flyAeroToBottomLeftOfElement(elementId, offsetX = 0, offsetY = 0) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            // Position to the left and at the bottom of the element
            // x: to the left of the element's left edge (positive offsetX moves further left)
            const x = window.innerWidth - rect.left + offsetX;
            // y: at the bottom of the element (positive offsetY moves down from bottom)
            const y = window.innerHeight - rect.bottom + offsetY;
            
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

        // Map search functionality
        let mapSearchTimeout;
        document.getElementById('mapSearchInput')?.addEventListener('input', function(e) {
            clearTimeout(mapSearchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                document.getElementById('mapSearchResults').classList.remove('show');
                return;
            }
            
            mapSearchTimeout = setTimeout(() => {
                performMapSearch(query);
            }, 300);
        });

        document.getElementById('mapSearchInput')?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performMapSearch();
            }
        });

        // Show Aero tip when user focuses on search input
        document.getElementById('mapSearchInput')?.addEventListener('focus', function() {
            setTimeout(() => {
                const searchInput = document.getElementById('mapSearchInput');
                const rect = searchInput.getBoundingClientRect();
                // Position to the left of the search input
                const x = window.innerWidth - rect.left + rect.width + 150; // 150px to the left of the input
                // Position below the header
                const y = window.innerHeight - rect.bottom - 20; // 20px below the input
                moveAeroToPosition(x, y);
                showAeroTip('search', 6000);
            }, 300);
        });

        async function performMapSearch(query = null) {
            const searchInput = document.getElementById('mapSearchInput');
            const searchQuery = query || searchInput.value.trim();
            const resultsDiv = document.getElementById('mapSearchResults');
            
            if (!searchQuery || searchQuery.length < 2) {
                resultsDiv.classList.remove('show');
                return;
            }
            
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxgl.accessToken}&types=place,locality,poi`
                );
                const data = await response.json();
                
                resultsDiv.innerHTML = '';
                
                if (data.features && data.features.length > 0) {
                    data.features.slice(0, 5).forEach(feature => {
                        const div = document.createElement('div');
                        div.className = 'search-result-map-item';
                        div.textContent = feature.place_name;
                        div.onclick = () => {
                            const [lng, lat] = feature.center;
                            map.flyTo({
                                center: [lng, lat],
                                zoom: 12,
                                duration: 2000
                            });
                            searchInput.value = '';
                            resultsDiv.classList.remove('show');
                        };
                        resultsDiv.appendChild(div);
                    });
                    resultsDiv.classList.add('show');
                } else {
                    resultsDiv.innerHTML = '<div class="search-result-map-item" style="color: #999;">No results found</div>';
                    resultsDiv.classList.add('show');
                }
            } catch (error) {
                console.error('Search error:', error);
                resultsDiv.innerHTML = '<div class="search-result-map-item" style="color: #999;">Search error. Please try again.</div>';
                resultsDiv.classList.add('show');
            }
        }

        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            const searchContainer = document.getElementById('searchPanel');
            const resultsDiv = document.getElementById('mapSearchResults');
            
            if (searchContainer && !searchContainer.contains(e.target)) {
                resultsDiv.classList.remove('show');
            }
        });

        // Check if user has an access code on page load
        function checkAccessCode() {
            const accessCode = localStorage.getItem('studyAbroadAccessCode');
            if (accessCode) {
                // User has a code, enable map and hide hero
                document.getElementById('map').classList.add('interactive');
                document.getElementById('heroSection').classList.add('hidden');
                document.getElementById('headerButtons').classList.add('visible');
                document.getElementById('filterPanel').style.display = 'block';
            document.getElementById('searchPanel').style.display = 'block';
                document.getElementById('searchPanel').style.display = 'block';
                document.getElementById('filterPanel').style.display = 'block';
                
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
                document.getElementById('filterPanel').style.display = 'block';
            document.getElementById('searchPanel').style.display = 'block';
                document.getElementById('searchPanel').style.display = 'block';
                document.getElementById('filterPanel').style.display = 'block';
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

        // Store markers for filtering
        const studentMarkers = [];
        let currentFilter = 'all';

        // Format date range for display
        function formatDateRange(startDate, endDate, semester) {
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const options = { month: 'short', year: 'numeric' };
                return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
            } else if (semester) {
                return semester;
            }
            return 'N/A';
        }

        // Calculate student status based on dates
        function calculateStudentStatus(student) {
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
            
            // Use startDate and endDate if available, otherwise fall back to semester parsing
            let startDate, endDate;
            
            if (student.startDate && student.endDate) {
                startDate = new Date(student.startDate);
                endDate = new Date(student.endDate);
            } else if (student.semester) {
                // Fallback to semester parsing for old data
                const semesterMatch = student.semester.match(/(WS|SS)\s*(\d{2})(?:\/(\d{2}))?/);
                if (!semesterMatch) return 'upcoming';
                
                const semesterType = semesterMatch[1];
                const year = parseInt('20' + semesterMatch[2]);
                
                if (semesterType === 'WS') {
                    startDate = new Date(year, 9, 1);
                    endDate = new Date(year + 1, 2, 31);
                } else {
                    startDate = new Date(year, 3, 1);
                    endDate = new Date(year, 8, 30);
                }
            } else {
                return 'upcoming'; // Default if no date info
            }
            
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            // Calculate one semester (6 months) after end date (for flight attendants)
            const oneSemesterAfter = new Date(endDate);
            oneSemesterAfter.setMonth(oneSemesterAfter.getMonth() + 6);
            
            // Determine status
            if (now < startDate) {
                return 'upcoming'; // About to go abroad
            } else if (now >= startDate && now <= endDate) {
                return 'abroad'; // Currently abroad
            } else if (now > endDate && now <= oneSemesterAfter) {
                return 'attendant'; // Flight attendant (returned, visible for one semester)
            } else {
                return 'attendant'; // Still show as attendant even if past one semester (for "all" filter)
            }
        }

        // Filter functions
        function toggleFilterPanel() {
            const filterContent = document.getElementById('filterContent');
            const isOpen = filterContent.classList.toggle('open');
            
            if (isOpen) {
                // Aero tip for filter menu - position to the left of the filter button in header
                setTimeout(() => {
                    const filterToggle = document.getElementById('filterToggle');
                    const rect = filterToggle.getBoundingClientRect();
                    // Position to the left of the filter button
                    // For right-based positioning: window.innerWidth - rect.left gives distance from right to left edge
                    // Add offset to move further left (away from right edge)
                    const x = window.innerWidth - rect.left + rect.width + 150; // 150px to the left of the button
                    // Position below the header
                    const y = window.innerHeight - rect.bottom - 20; // 20px below the button
                    moveAeroToPosition(x, y);
                    showAeroTip('filter', 6000);
                }, 300);
            }
        }

        function applyFilter(filterType) {
            currentFilter = filterType;
            
            // Update active button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
            
            // Filter markers
            studentMarkers.forEach(markerData => {
                const { marker, student } = markerData;
                const status = calculateStudentStatus(student);
                
                let shouldShow = false;
                
                if (filterType === 'all') {
                    // Show all students regardless of status
                    shouldShow = true;
                } else if (filterType === 'abroad') {
                    shouldShow = status === 'abroad';
                } else if (filterType === 'upcoming') {
                    shouldShow = status === 'upcoming';
                } else if (filterType === 'attendant') {
                    shouldShow = status === 'attendant';
                }
                
                // Show/hide marker
                const markerElement = marker.getElement();
                if (shouldShow) {
                    markerElement.style.display = 'block';
                } else {
                    markerElement.style.display = 'none';
                }
            });
            
            // Update stats
            updateStats();
        }

        const students = [
            { 
                name: "Lisa", 
                origin: "Munich, Germany",
                location: "Barcelona, Spain", 
                lat: 41.3851, 
                lng: 2.1734, 
                university: "Universitat de Barcelona", 
                startDate: "2024-10-01",
                endDate: "2025-03-31",
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
                startDate: "2025-10-01",
                endDate: "2026-03-31",
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
                startDate: "2025-04-01",
                endDate: "2025-09-30",
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
                startDate: "2025-10-01",
                endDate: "2026-03-31",
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
                startDate: "2026-04-01",
                endDate: "2026-09-30",
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
                startDate: "2025-10-01",
                endDate: "2026-03-31",
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
                startDate: "2025-04-01",
                endDate: "2025-09-30",
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
                startDate: "2024-10-01",
                endDate: "2025-03-31",
                semester: "WS 24/25", 
                img: "https://i.pravatar.cc/150?img=33",
                instagram: "felix_amsterdam",
                major: "Economics",
                languages: "German, English, Dutch (learning)",
                lookingFor: "Nightlife & Sports Partners",
                about: "Economics student from Hamburg. Looking forward to the bike culture and nightlife in Amsterdam!"
            },
            {
                name: "Sofia",
                origin: "Barcelona, Spain",
                location: "Paris, France",
                lat: 48.8566,
                lng: 2.3522,
                university: "Sorbonne University",
                startDate: "2025-09-15",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=21",
                instagram: "sofia_in_paris",
                major: "International Relations",
                languages: "Spanish, English, French",
                lookingFor: "Friends & Cultural Exchange",
                about: "International Relations student from Barcelona. Excited to explore Parisian culture and meet students from around the world."
            },
            {
                name: "Liam",
                origin: "Dublin, Ireland",
                location: "Amsterdam, Netherlands",
                lat: 52.3676,
                lng: 4.9041,
                university: "University of Amsterdam",
                startDate: "2025-09-01",
                endDate: "2026-02-15",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=32",
                instagram: "liam_amsterdam",
                major: "Business Administration",
                languages: "English",
                lookingFor: "Networking & Friends",
                about: "Business student from Dublin. Looking forward to studying in Amsterdam and connecting with international students."
            },
            {
                name: "Hannah",
                origin: "Vienna, Austria",
                location: "Copenhagen, Denmark",
                lat: 55.6761,
                lng: 12.5683,
                university: "University of Copenhagen",
                startDate: "2026-02-01",
                endDate: "2026-07-31",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=45",
                instagram: "hannah_cph",
                major: "Environmental Science",
                languages: "German, English, Danish",
                lookingFor: "Study Buddy & Outdoor Activities",
                about: "Environmental Science student passionate about sustainability. Excited to study in Copenhagen and enjoy the Scandinavian lifestyle."
            },
            {
                name: "Marco",
                origin: "Milan, Italy",
                location: "Madrid, Spain",
                lat: 40.4168,
                lng: -3.7038,
                university: "Universidad Complutense de Madrid",
                startDate: "2025-09-20",
                endDate: "2026-01-20",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=17",
                instagram: "marco_madrid",
                major: "Economics",
                languages: "Italian, Spanish, English",
                lookingFor: "Friends & Language Exchange",
                about: "Economics student from Milan. Looking forward to improving my Spanish and enjoying life in Madrid."
            },
            {
                name: "Emma",
                origin: "Toronto, Canada",
                location: "Edinburgh, UK",
                lat: 55.9533,
                lng: -3.1883,
                university: "University of Edinburgh",
                startDate: "2025-09-10",
                endDate: "2026-03-20",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=28",
                instagram: "emma_edinburgh",
                major: "History",
                languages: "English, French",
                lookingFor: "Study Group & City Explorers",
                about: "History student from Canada. Excited to study in Edinburgh and explore Scottish history and culture."
            },
            {
                name: "Noah",
                origin: "Berlin, Germany",
                location: "Stockholm, Sweden",
                lat: 59.3293,
                lng: 18.0686,
                university: "Stockholm University",
                startDate: "2026-01-15",
                endDate: "2026-06-30",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=39",
                instagram: "noah_stockholm",
                major: "Data Science",
                languages: "German, English, Swedish",
                lookingFor: "Tech Friends & Study Group",
                about: "Data Science student interested in AI and analytics. Looking forward to studying in Stockholm’s innovative environment."
            },
            {
                name: "Aisha",
                origin: "Casablanca, Morocco",
                location: "Lyon, France",
                lat: 45.7640,
                lng: 4.8357,
                university: "Université de Lyon",
                startDate: "2025-09-05",
                endDate: "2026-02-10",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=52",
                instagram: "aisha_lyon",
                major: "Political Science",
                languages: "Arabic, French, English",
                lookingFor: "Friends & Academic Exchange",
                about: "Political Science student with a strong interest in European politics. Excited to study and live in Lyon."
            },
            {
                name: "Lucas",
                origin: "São Paulo, Brazil",
                location: "Lisbon, Portugal",
                lat: 38.7223,
                lng: -9.1393,
                university: "University of Lisbon",
                startDate: "2026-02-01",
                endDate: "2026-07-15",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=60",
                instagram: "lucas_lisboa",
                major: "Architecture",
                languages: "Portuguese, English, Spanish",
                lookingFor: "Creative Projects & Friends",
                about: "Architecture student from Brazil. Inspired by Lisbon’s design, history, and coastal lifestyle."
            },
            {
                name: "Yuki",
                origin: "Osaka, Japan",
                location: "Helsinki, Finland",
                lat: 60.1699,
                lng: 24.9384,
                university: "University of Helsinki",
                startDate: "2025-09-01",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=8",
                instagram: "yuki_helsinki",
                major: "Education",
                languages: "Japanese, English",
                lookingFor: "Friends & Cultural Exchange",
                about: "Education student interested in the Finnish school system. Excited to experience life in Helsinki."
            },
            {
                name: "Daniel",
                origin: "Zurich, Switzerland",
                location: "Prague, Czech Republic",
                lat: 50.0755,
                lng: 14.4378,
                university: "Charles University",
                startDate: "2025-09-15",
                endDate: "2026-02-28",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=19",
                instagram: "daniel_prague",
                major: "Philosophy",
                languages: "German, English, Czech",
                lookingFor: "Discussion Groups & Friends",
                about: "Philosophy student from Zurich. Looking forward to deep discussions and discovering Prague’s historic charm."
            },
            {
                name: "Elena",
                origin: "Rome, Italy",
                location: "Berlin, Germany",
                lat: 52.5200,
                lng: 13.4050,
                university: "Humboldt University of Berlin",
                startDate: "2025-10-01",
                endDate: "2026-03-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=14",
                instagram: "elena_berlin",
                major: "Art History",
                languages: "Italian, English, German",
                lookingFor: "Museum Visits & Friends",
                about: "Art History student from Rome excited to explore Berlin’s vibrant art and culture scene."
            },
            {
                name: "Jonas",
                origin: "Hamburg, Germany",
                location: "Oslo, Norway",
                lat: 59.9139,
                lng: 10.7522,
                university: "University of Oslo",
                startDate: "2026-01-15",
                endDate: "2026-06-30",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=41",
                instagram: "jonas_oslo",
                major: "Renewable Energy Engineering",
                languages: "German, English, Norwegian",
                lookingFor: "Study Group & Hiking Buddies",
                about: "Engineering student passionate about renewable energy and outdoor adventures in Norway."
            },
            {
                name: "Clara",
                origin: "Lyon, France",
                location: "Florence, Italy",
                lat: 43.7696,
                lng: 11.2558,
                university: "University of Florence",
                startDate: "2025-09-20",
                endDate: "2026-02-10",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=25",
                instagram: "clara_firenze",
                major: "Literature",
                languages: "French, Italian, English",
                lookingFor: "Book Clubs & Friends",
                about: "Literature student inspired by Italian culture, poetry, and Renaissance history."
            },
            {
                name: "Mateo",
                origin: "Bogotá, Colombia",
                location: "Vienna, Austria",
                lat: 48.2082,
                lng: 16.3738,
                university: "University of Vienna",
                startDate: "2025-10-01",
                endDate: "2026-03-15",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=34",
                instagram: "mateo_vienna",
                major: "Political Economy",
                languages: "Spanish, English, German",
                lookingFor: "Debates & International Friends",
                about: "Political Economy student interested in European policy and global development."
            },
            {
                name: "Nina",
                origin: "Ljubljana, Slovenia",
                location: "Zagreb, Croatia",
                lat: 45.8150,
                lng: 15.9819,
                university: "University of Zagreb",
                startDate: "2026-02-01",
                endDate: "2026-07-01",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=47",
                instagram: "nina_zagreb",
                major: "Psychology",
                languages: "Slovene, English, Croatian",
                lookingFor: "Study Partner & Friends",
                about: "Psychology student excited to experience student life in Zagreb."
            },
            {
                name: "Oliver",
                origin: "Manchester, UK",
                location: "Dublin, Ireland",
                lat: 53.3498,
                lng: -6.2603,
                university: "Trinity College Dublin",
                startDate: "2025-09-10",
                endDate: "2026-03-01",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=5",
                instagram: "oliver_dublin",
                major: "English Literature",
                languages: "English",
                lookingFor: "Reading Groups & Friends",
                about: "Literature student looking forward to Irish culture and classic storytelling."
            },
            {
                name: "Sara",
                origin: "Tehran, Iran",
                location: "Leiden, Netherlands",
                lat: 52.1601,
                lng: 4.4970,
                university: "Leiden University",
                startDate: "2025-09-01",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=56",
                instagram: "sara_leiden",
                major: "International Law",
                languages: "Persian, English, Dutch",
                lookingFor: "Academic Networking & Friends",
                about: "Law student interested in international justice and human rights."
            },
            {
                name: "Alex",
                origin: "Seattle, USA",
                location: "Zurich, Switzerland",
                lat: 47.3769,
                lng: 8.5417,
                university: "ETH Zurich",
                startDate: "2026-02-15",
                endDate: "2026-07-30",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=12",
                instagram: "alex_zurich",
                major: "Robotics",
                languages: "English, German",
                lookingFor: "Tech Projects & Friends",
                about: "Robotics student excited to study at one of Europe’s top technical universities."
            },
            {
                name: "Isabel",
                origin: "Seville, Spain",
                location: "Ghent, Belgium",
                lat: 51.0543,
                lng: 3.7174,
                university: "Ghent University",
                startDate: "2025-09-15",
                endDate: "2026-02-15",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=63",
                instagram: "isabel_ghent",
                major: "Biotechnology",
                languages: "Spanish, English, Dutch",
                lookingFor: "Lab Partners & Friends",
                about: "Biotech student eager to gain hands-on research experience abroad."
            },
            {
                name: "Thomas",
                origin: "Brussels, Belgium",
                location: "Luxembourg City, Luxembourg",
                lat: 49.6116,
                lng: 6.1319,
                university: "University of Luxembourg",
                startDate: "2025-10-01",
                endDate: "2026-03-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=27",
                instagram: "thomas_lux",
                major: "European Studies",
                languages: "French, English, German",
                lookingFor: "Policy Talks & Friends",
                about: "European Studies student passionate about EU institutions and multicultural life."
            },
            {
                name: "Maya",
                origin: "Tel Aviv, Israel",
                location: "Athens, Greece",
                lat: 37.9838,
                lng: 23.7275,
                university: "National and Kapodistrian University of Athens",
                startDate: "2026-02-01",
                endDate: "2026-06-30",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=48",
                instagram: "maya_athens",
                major: "Archaeology",
                languages: "Hebrew, English, Greek",
                lookingFor: "Excursions & Study Group",
                about: "Archaeology student thrilled to study near ancient historical sites."
            },
            {
                name: "Victor",
                origin: "Bucharest, Romania",
                location: "Krakow, Poland",
                lat: 50.0647,
                lng: 19.9450,
                university: "Jagiellonian University",
                startDate: "2025-09-20",
                endDate: "2026-02-10",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=9",
                instagram: "victor_krakow",
                major: "Sociology",
                languages: "Romanian, English, Polish",
                lookingFor: "Discussion Groups & Friends",
                about: "Sociology student interested in Central European cultures."
            },
            {
                name: "Paula",
                origin: "Porto, Portugal",
                location: "Valencia, Spain",
                lat: 39.4699,
                lng: -0.3763,
                university: "University of Valencia",
                startDate: "2026-02-01",
                endDate: "2026-07-01",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=54",
                instagram: "paula_valencia",
                major: "Nutrition Science",
                languages: "Portuguese, Spanish, English",
                lookingFor: "Healthy Living & Friends",
                about: "Nutrition student passionate about Mediterranean food and lifestyle."
            },
            {
                name: "Kevin",
                origin: "Vancouver, Canada",
                location: "Lausanne, Switzerland",
                lat: 46.5197,
                lng: 6.6323,
                university: "EPFL",
                startDate: "2025-09-15",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=3",
                instagram: "kevin_epfl",
                major: "Mechanical Engineering",
                languages: "English, French",
                lookingFor: "Study Group & Sports",
                about: "Engineering student excited to study near the Alps and Lake Geneva."
            },
            {
                name: "Anya",
                origin: "Sofia, Bulgaria",
                location: "Tallinn, Estonia",
                lat: 59.4370,
                lng: 24.7536,
                university: "Tallinn University",
                startDate: "2025-10-01",
                endDate: "2026-03-15",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=59",
                instagram: "anya_tallinn",
                major: "Digital Media",
                languages: "Bulgarian, English, Russian",
                lookingFor: "Creative Collaborations",
                about: "Digital Media student fascinated by Estonia’s digital innovation."
            },
            {
                name: "Robert",
                origin: "Chicago, USA",
                location: "Bologna, Italy",
                lat: 44.4949,
                lng: 11.3426,
                university: "University of Bologna",
                startDate: "2025-09-20",
                endDate: "2026-02-20",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=22",
                instagram: "robert_bologna",
                major: "Law",
                languages: "English, Italian",
                lookingFor: "Study Partners & Friends",
                about: "Law student excited to study at the oldest university in Europe."
            },
            {
                name: "Lea",
                origin: "Basel, Switzerland",
                location: "Innsbruck, Austria",
                lat: 47.2692,
                lng: 11.4041,
                university: "University of Innsbruck",
                startDate: "2026-02-01",
                endDate: "2026-07-15",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=44",
                instagram: "lea_innsbruck",
                major: "Sports Science",
                languages: "German, English",
                lookingFor: "Training Partners & Friends",
                about: "Sports Science student who loves mountains, skiing, and outdoor fitness."
            },
            {
                name: "Omar",
                origin: "Amman, Jordan",
                location: "Budapest, Hungary",
                lat: 47.4979,
                lng: 19.0402,
                university: "Eötvös Loránd University",
                startDate: "2025-09-01",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=36",
                instagram: "omar_budapest",
                major: "International Business",
                languages: "Arabic, English, Hungarian",
                lookingFor: "Networking & Friends",
                about: "Business student interested in emerging European markets."
            },
            {
                name: "Freja",
                origin: "Aarhus, Denmark",
                location: "Reykjavik, Iceland",
                lat: 64.1466,
                lng: -21.9426,
                university: "University of Iceland",
                startDate: "2026-01-10",
                endDate: "2026-06-20",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=18",
                instagram: "freja_iceland",
                major: "Geography",
                languages: "Danish, English, Icelandic",
                lookingFor: "Nature Trips & Study Group",
                about: "Geography student fascinated by volcanoes, glaciers, and extreme landscapes."
            },
            {
                name: "Aarav",
                origin: "Delhi, India",
                location: "Singapore",
                lat: 1.3521,
                lng: 103.8198,
                university: "National University of Singapore",
                startDate: "2025-08-15",
                endDate: "2026-05-15",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=64",
                instagram: "aarav_sg",
                major: "Computer Engineering",
                languages: "Hindi, English",
                lookingFor: "Hackathons & Friends",
                about: "Engineering student interested in startups, AI, and Singapore’s tech ecosystem."
            },
            {
                name: "Mei",
                origin: "Shanghai, China",
                location: "Vancouver, Canada",
                lat: 49.2827,
                lng: -123.1207,
                university: "University of British Columbia",
                startDate: "2025-09-01",
                endDate: "2026-04-30",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=11",
                instagram: "mei_ubc",
                major: "Environmental Studies",
                languages: "Mandarin, English",
                lookingFor: "Study Group & Nature Trips",
                about: "Environmental Studies student passionate about sustainability and outdoor activities."
            },
            {
                name: "Ethan",
                origin: "San Diego, USA",
                location: "Sydney, Australia",
                lat: -33.8688,
                lng: 151.2093,
                university: "University of Sydney",
                startDate: "2026-02-01",
                endDate: "2026-11-30",
                semester: "AY 26",
                img: "https://i.pravatar.cc/150?img=7",
                instagram: "ethan_sydney",
                major: "Marine Biology",
                languages: "English",
                lookingFor: "Surfing & Study Partners",
                about: "Marine Biology student excited to study ocean ecosystems and coastal life."
            },
            {
                name: "Fatima",
                origin: "Rabat, Morocco",
                location: "Doha, Qatar",
                lat: 25.2854,
                lng: 51.5310,
                university: "Qatar University",
                startDate: "2025-09-10",
                endDate: "2026-05-20",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=58",
                instagram: "fatima_doha",
                major: "Public Policy",
                languages: "Arabic, French, English",
                lookingFor: "Academic Discussions & Friends",
                about: "Public Policy student interested in governance and development in the Middle East."
            },
            {
                name: "Lucas",
                origin: "Rosario, Argentina",
                location: "Santiago, Chile",
                lat: -33.4489,
                lng: -70.6693,
                university: "Pontificia Universidad Católica de Chile",
                startDate: "2025-08-01",
                endDate: "2025-12-15",
                semester: "FS 25",
                img: "https://i.pravatar.cc/150?img=33",
                instagram: "lucas_scl",
                major: "Economics",
                languages: "Spanish, English",
                lookingFor: "Study Group & Hiking",
                about: "Economics student interested in Latin American markets and policy."
            },
            {
                name: "Nour",
                origin: "Alexandria, Egypt",
                location: "Kuala Lumpur, Malaysia",
                lat: 3.1390,
                lng: 101.6869,
                university: "University of Malaya",
                startDate: "2025-09-01",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=50",
                instagram: "nour_kl",
                major: "International Relations",
                languages: "Arabic, English",
                lookingFor: "Cultural Exchange & Friends",
                about: "IR student fascinated by Southeast Asian politics and culture."
            },
            {
                name: "Takumi",
                origin: "Nagoya, Japan",
                location: "Seoul, South Korea",
                lat: 37.5665,
                lng: 126.9780,
                university: "Yonsei University",
                startDate: "2025-09-01",
                endDate: "2026-02-28",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=2",
                instagram: "takumi_seoul",
                major: "Media Studies",
                languages: "Japanese, Korean, English",
                lookingFor: "Creative Projects & Friends",
                about: "Media student interested in film, pop culture, and digital storytelling."
            },
            {
                name: "Zanele",
                origin: "Durban, South Africa",
                location: "Cape Town, South Africa",
                lat: -33.9249,
                lng: 18.4241,
                university: "University of Cape Town",
                startDate: "2025-07-15",
                endDate: "2026-06-30",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=61",
                instagram: "zanele_uct",
                major: "Sociology",
                languages: "Zulu, English",
                lookingFor: "Research Partners & Friends",
                about: "Sociology student interested in urban studies and social change."
            },
            {
                name: "Mateus",
                origin: "Recife, Brazil",
                location: "Bogotá, Colombia",
                lat: 4.7110,
                lng: -74.0721,
                university: "Universidad de los Andes",
                startDate: "2025-08-15",
                endDate: "2025-12-20",
                semester: "FS 25",
                img: "https://i.pravatar.cc/150?img=40",
                instagram: "mateus_bogota",
                major: "Anthropology",
                languages: "Portuguese, Spanish, English",
                lookingFor: "Fieldwork & Friends",
                about: "Anthropology student excited to study culture and society in Latin America."
            },
            {
                name: "Hana",
                origin: "Auckland, New Zealand",
                location: "Tokyo, Japan",
                lat: 35.6762,
                lng: 139.6503,
                university: "Waseda University",
                startDate: "2025-09-20",
                endDate: "2026-03-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=16",
                instagram: "hana_tokyo",
                major: "Japanese Studies",
                languages: "English, Japanese",
                lookingFor: "Language Exchange & Friends",
                about: "Japanese Studies student passionate about language immersion and culture."
            },
            {
                name: "Carlos",
                origin: "Monterrey, Mexico",
                location: "Austin, USA",
                lat: 30.2672,
                lng: -97.7431,
                university: "University of Texas at Austin",
                startDate: "2025-08-25",
                endDate: "2026-05-10",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=26",
                instagram: "carlos_utexas",
                major: "Electrical Engineering",
                languages: "Spanish, English",
                lookingFor: "Study Group & Sports",
                about: "Engineering student interested in innovation, hardware, and startups."
            },
            {
                name: "Lina",
                origin: "Beirut, Lebanon",
                location: "Istanbul, Turkey",
                lat: 41.0082,
                lng: 28.9784,
                university: "Boğaziçi University",
                startDate: "2025-09-15",
                endDate: "2026-01-31",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=57",
                instagram: "lina_istanbul",
                major: "Architecture",
                languages: "Arabic, English, Turkish",
                lookingFor: "Design Projects & Friends",
                about: "Architecture student inspired by historic and modern urban design."
            },
            {
                name: "Samuel",
                origin: "Accra, Ghana",
                location: "Toronto, Canada",
                lat: 43.6532,
                lng: -79.3832,
                university: "University of Toronto",
                startDate: "2025-09-01",
                endDate: "2026-04-30",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=37",
                instagram: "samuel_uoft",
                major: "Public Health",
                languages: "English",
                lookingFor: "Research & Friends",
                about: "Public Health student focused on global health systems and equity."
            },
            {
                name: "Yara",
                origin: "São Luís, Brazil",
                location: "Lisbon, Portugal",
                lat: 38.7223,
                lng: -9.1393,
                university: "ISCTE – University Institute of Lisbon",
                startDate: "2025-09-10",
                endDate: "2026-02-15",
                semester: "WS 25/26",
                img: "https://i.pravatar.cc/150?img=65",
                instagram: "yara_lisboa",
                major: "Cultural Studies",
                languages: "Portuguese, English",
                lookingFor: "Cultural Projects & Friends",
                about: "Cultural Studies student exploring Lusophone cultures and history."
            },
            {
                name: "Owen",
                origin: "Wellington, New Zealand",
                location: "San Francisco, USA",
                lat: 37.7749,
                lng: -122.4194,
                university: "University of California, Berkeley",
                startDate: "2025-08-20",
                endDate: "2026-05-15",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=6",
                instagram: "owen_berkeley",
                major: "Computer Science",
                languages: "English",
                lookingFor: "Startup Projects & Friends",
                about: "CS student excited about Silicon Valley innovation and entrepreneurship."
            },
            {
                name: "Priya",
                origin: "Bangalore, India",
                location: "Zurich, Switzerland",
                lat: 47.3769,
                lng: 8.5417,
                university: "University of Zurich",
                startDate: "2026-02-01",
                endDate: "2026-07-31",
                semester: "SS 26",
                img: "https://i.pravatar.cc/150?img=29",
                instagram: "priya_uzh",
                major: "Neuroscience",
                languages: "English, Hindi, German",
                lookingFor: "Lab Partners & Friends",
                about: "Neuroscience student interested in cognitive science and research."
            },
            {
                name: "Diego",
                origin: "La Paz, Bolivia",
                location: "Lima, Peru",
                lat: -12.0464,
                lng: -77.0428,
                university: "Pontifical Catholic University of Peru",
                startDate: "2025-08-01",
                endDate: "2025-12-20",
                semester: "FS 25",
                img: "https://i.pravatar.cc/150?img=23",
                instagram: "diego_lima",
                major: "Development Studies",
                languages: "Spanish, English",
                lookingFor: "NGO Projects & Friends",
                about: "Development Studies student focused on social impact in South America."
            },
            {
                name: "Amelia",
                origin: "Perth, Australia",
                location: "Honolulu, USA",
                lat: 21.3069,
                lng: -157.8583,
                university: "University of Hawaiʻi at Mānoa",
                startDate: "2025-08-20",
                endDate: "2026-05-10",
                semester: "AY 25/26",
                img: "https://i.pravatar.cc/150?img=10",
                instagram: "amelia_hawaii",
                major: "Oceanography",
                languages: "English",
                lookingFor: "Research & Surf Buddies",
                about: "Oceanography student passionate about coral reefs and marine conservation."
            }
            
            
            
        ];

        // Create markers and store them for filtering
        function createStudentMarker(student) {
            const el = document.createElement('div');
            el.className = 'student-marker';
            el.style.backgroundImage = `url('${student.img}')`;
            
            el.addEventListener('click', () => {
                openSidebar(student);
            });

            const marker = new mapboxgl.Marker(el)
                .setLngLat([student.lng, student.lat])
                .addTo(map);
            
            // Store marker with student data
            studentMarkers.push({ marker, student });
        }

        // Create markers for all students
        students.forEach(student => {
            createStudentMarker(student);
        });
        
        // Apply initial filter after all markers are created
        applyFilter('all');

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
                        <div class="pass-label">Study Period</div>
                        <div class="pass-value">${formatDateRange(student.startDate, student.endDate, student.semester)}</div>
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
                    <div class="barcode-container">
                        <canvas class="barcode-canvas"></canvas>
                        <div class="tag-section">
                            <div class="tag-text">Tag us here<br>@studyabroadfriends</div>
                        </div>
                    </div>
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

            const barcodeContainer = canvas.parentElement;
            const passBottom = barcodeContainer.parentElement;
            // Get the actual width, accounting for padding (25px on each side)
            const containerWidth = passBottom.offsetWidth;
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
                const tagSection = boardingPass.querySelector('.tag-section');
                
                const originalImageDisplay = profileImage ? profileImage.style.display : null;
                const originalButtonDisplay = connectButton ? connectButton.style.display : null;
                const originalTagDisplay = tagSection ? tagSection.style.display : null;
                
                if (profileImage) profileImage.style.display = 'none';
                if (connectButton) connectButton.style.display = 'none';
                if (tagSection) tagSection.style.display = 'block';

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
                if (tagSection) tagSection.style.display = originalTagDisplay || 'none';

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
            const startDate = formData.get('startDate');
            const endDate = formData.get('endDate');
            
            // Validate dates
            if (new Date(startDate) >= new Date(endDate)) {
                alert('End date must be after start date!');
                return;
            }
            
            const newStudent = {
                name: formData.get('name'),
                origin: `${formData.get('originCity')}, ${formData.get('originCountry')}`,
                location: `${selectedLocationData.city}, ${selectedLocationData.country}`,
                lat: parseFloat(selectedLocationData.lat),
                lng: parseFloat(selectedLocationData.lng),
                university: formData.get('university'),
                startDate: startDate,
                endDate: endDate,
                img: uploadedImageData,
                instagram: formData.get('instagram'),
                major: formData.get('major'),
                languages: formData.get('languages'),
                lookingFor: formData.get('lookingFor'),
                about: formData.get('about')
            };

            students.push(newStudent);
            
            // Create marker using the same function
            createStudentMarker(newStudent);
            
            // Apply current filter to new marker
            applyFilter(currentFilter);
            
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
            document.getElementById('filterPanel').style.display = 'block';
            document.getElementById('searchPanel').style.display = 'block';
            
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
            // Count students based on current filter - use students array directly for accuracy
            let visibleStudents = [];
            
            if (currentFilter === 'all') {
                // Show all students regardless of status
                visibleStudents = students;
            } else {
                // Filter based on status
                visibleStudents = students.filter(student => {
                    const status = calculateStudentStatus(student);
                    if (currentFilter === 'abroad') {
                        return status === 'abroad';
                    } else if (currentFilter === 'upcoming') {
                        return status === 'upcoming';
                    } else if (currentFilter === 'attendant') {
                        return status === 'attendant';
                    }
                    return false;
                });
            }
            
            const visibleCountries = new Set(
                visibleStudents.map(s => {
                    const parts = s.location.split(',');
                    return parts.length > 1 ? parts[1].trim() : parts[0].trim();
                })
            );
            
            document.getElementById('student-count').textContent = visibleStudents.length;
            document.getElementById('country-count').textContent = visibleCountries.size;
            document.getElementById('connection-count').textContent = Math.floor(visibleStudents.length * 2.3);
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
            
            // Update stats with actual counts after a short delay to ensure markers are created
            setTimeout(() => {
                updateStats();
                // Animate the numbers after getting actual counts
                const studentCount = parseInt(document.getElementById('student-count').textContent) || 0;
                const countryCount = parseInt(document.getElementById('country-count').textContent) || 0;
                const connectionCount = parseInt(document.getElementById('connection-count').textContent) || 0;
                
                // Reset to 0 and animate
                document.getElementById('student-count').textContent = '0';
                document.getElementById('country-count').textContent = '0';
                document.getElementById('connection-count').textContent = '0';
                
                animateNumber('student-count', studentCount, 2000);
                animateNumber('country-count', countryCount, 2000);
                animateNumber('connection-count', connectionCount, 2000);
            }, 500);
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