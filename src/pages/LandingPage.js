import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % 4);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const reveals = document.querySelectorAll('.reveal');

            for (let i = 0; i < reveals.length; i++) {
                const windowHeight = window.innerHeight;
                const elementTop = reveals[i].getBoundingClientRect().top;
                const elementVisible = 150;

                if (elementTop < windowHeight - elementVisible) {
                    reveals[i].classList.add('active');
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        // Trigger once on load
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="landing-page">
            <nav className="navbar">
                <div className="nav-brand">PODAGO</div>
                <button className="btn-login" onClick={() => navigate('/login')}>
                    Member Login
                </button>
            </nav>

            <header className="hero">
                <div className="hero-content">
                    <h1 className="hero-title animate-hero-title">
                        Podago <span>Dairy Cooperative</span>
                    </h1>
                    <p className="hero-subtitle animate-hero-subtitle">
                        Empowering farmers through technology, transparency, and reliable markets.
                    </p>
                    <div className="hero-buttons animate-hero-btn">
                        <button className="btn-login" style={{ fontSize: '1.2rem', padding: '1rem 3rem' }} onClick={() => navigate('/login')}>
                            Access Portal
                        </button>
                        <a
                            href="https://github.com/muchirimorris/podago/releases/download/final/app-release.apk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-download"
                        >
                            Download App
                        </a>
                    </div>
                </div>
            </header>

            <section className="content-section about reveal">
                <div className="section-container">
                    <div className="about-grid">
                        <div className="about-image">
                            <img src="/assets/about-img.png" alt="Farmer Partnership" />
                        </div>
                        <div className="overview-text" style={{ textAlign: 'left', padding: '0', background: 'none', border: 'none' }}>
                            <h2 className="section-header" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>About Podago Dairy Cooperative</h2>
                            <p>
                                Podago Dairy Cooperative Society (PODAGO) is a farmer-owned cooperative based in Kagumo, Kirinyaga County, Kenya, focused on improving the livelihoods of small-scale dairy farmers through organized milk collection, value addition, and market access.
                            </p>
                            <p>
                                Founded in 2005 by a small group of farmers, the cooperative has grown into a key dairy hub in the region, supporting thousands of farmers and strengthening rural agricultural development.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section bg-light reveal" style={{ paddingTop: '6rem' }}>
                <div className="section-container">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Started With</h3>
                            <span className="stat-value">5</span>
                            <p>Farmers producing 25 litres/day</p>
                        </div>
                        <div className="stat-card delay-100">
                            <h3>Currently Serves</h3>
                            <span className="stat-value">2,800+</span>
                            <p>Active Farmers</p>
                        </div>
                        <div className="stat-card delay-200">
                            <h3>Daily Collection</h3>
                            <span className="stat-value">5,400+</span>
                            <p>Litres of Milk</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section center-text reveal">
                <div className="section-container">
                    <h2 className="section-header">Core Activities</h2>
                    <div className="activities-grid">
                        <div className="activity-item">
                            <span className="activity-icon">🥛</span>
                            <span>Milk collection and bulking from farmers</span>
                        </div>
                        <div className="activity-item delay-100">
                            <span className="activity-icon">❄️</span>
                            <span>Milk cooling and storage to reduce spoilage</span>
                        </div>
                        <div className="activity-item delay-200">
                            <span className="activity-icon">🚚</span>
                            <span>Transportation of milk to processors</span>
                        </div>
                        <div className="activity-item delay-100">
                            <span className="activity-icon">🐄</span>
                            <span>Support services such as feed supply and animal improvement</span>
                        </div>
                        <div className="activity-item delay-200">
                            <span className="activity-icon">💰</span>
                            <span>Facilitating farmer payments and financial services</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section bg-dark reveal">
                <div className="section-container">
                    <div className="mission-vision-grid">
                        <div className="mv-card">
                            <h3>Mission</h3>
                            <p>To empower smallholder farmers by providing efficient, reliable, and transparent dairy services that improve productivity and incomes.</p>
                        </div>
                        <div className="mv-card delay-200">
                            <h3>Vision</h3>
                            <p>To become a leading dairy cooperative in Kenya, delivering high-quality milk products while improving the livelihoods of farming communities.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section reveal">
                <div className="section-container">
                    <div className="split-grid">
                        <div className="split-col">
                            <h2 className="section-header-small">Impact on Farmers</h2>
                            <ul className="impact-list">
                                <li>Increasing farmers’ incomes through structured milk markets</li>
                                <li>Reducing post-harvest losses using cooling facilities</li>
                                <li>Providing access to inputs such as feed and artificial insemination</li>
                                <li>Supporting value addition initiatives like yoghurt processing</li>
                            </ul>
                        </div>
                        <div className="split-col">
                            <div className="split-image">
                                <img src="/assets/tech-img.png" alt="Modern Dairy Infrastructure" />
                            </div>
                        </div>
                    </div>
                    <div className="split-grid reveal" style={{ paddingTop: '0' }}>
                        <div className="split-col">
                            <div className="split-image">
                                <img src="/assets/transport-img.png" alt="Logistics Network" />
                            </div>
                        </div>
                        <div className="split-col">
                            <h2 className="section-header-small">Infrastructure & Support</h2>
                            <ul className="impact-list">
                                <li>Milk cooling equipment to preserve milk quality</li>
                                <li>Power backup systems for continuous operations</li>
                                <li>Plans for value addition (e.g., yoghurt processing)</li>
                                <li>Dairy equipment supply services through affiliated businesses</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section bg-light reveal">
                <div className="section-container">
                    <h2 className="section-header">Life at Podago</h2>
                    <div className="slideshow-container">
                        {/* Slideshow Logic implemented above or inline? Better to extract data and map */}
                        {[
                            { src: "/assets/community-img.png", title: "Our Community", text: "Growing together as a family" },
                            { src: "/assets/lab-img.png", title: "Quality Assurance", text: "Rigorous testing standards" },
                            { src: "/assets/about-img.png", title: "Trusted Partnerships", text: "Farmer-first approach" },
                            { src: "/assets/hero-bg.png", title: "Sustainability", text: "Green farming practices for a better future" }
                        ].map((slide, index) => (
                            <div
                                key={index}
                                className={`slide-item ${index === currentSlide ? 'active' : ''}`}
                                style={{ backgroundImage: `url(${slide.src})` }}
                            >
                                <div className="slide-content">
                                    <h4>{slide.title}</h4>
                                    <p>{slide.text}</p>
                                </div>
                            </div>
                        ))}

                        <div className="slide-indicators">
                            {[0, 1, 2, 3].map(idx => (
                                <span
                                    key={idx}
                                    className={`indicator ${idx === currentSlide ? 'active' : ''}`}
                                    onClick={() => setCurrentSlide(idx)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="final-cta reveal">
                <p className="highlight-text">These improvements enhance efficiency and reduce losses across the dairy value chain.</p>
                <div style={{ marginTop: '2rem' }}>
                    <a
                        href="https://github.com/muchirimorris/podago/releases/download/final/app-release.apk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-download"
                        style={{ display: 'inline-block', textDecoration: 'none' }}
                    >
                        Download Android App
                    </a>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-column">
                        <h4>Podago Cooperative</h4>
                        <p>Empowering farmers through technology and transparency.</p>
                    </div>
                    <div className="footer-column">
                        <h4>Quick Links</h4>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a href="#">About Us</a>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a href="#">Services</a>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a href="#">Contact</a>
                        <a
                            href="https://github.com/muchirimorris/podago/releases/download/final/app-release.apk"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Download App
                        </a>
                    </div>
                    <div className="footer-column">
                        <h4>Contact Us</h4>
                        <p>info@podago.co.ke</p>
                        <p>+254 700 000 000</p>
                        <p>Nairobi, Kenya</p>
                    </div>
                </div>
                <div className="footer-bottom">
                    &copy; {new Date().getFullYear()} Podago Cooperative. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
