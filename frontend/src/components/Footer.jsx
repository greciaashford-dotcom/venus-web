import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Instagram, Facebook, Linkedin, Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { STORE, STORE_HOURS, STORE_MAPS_URL, WAREHOUSE_MAPS_URL } from "../data/storeInfo";
import "./Footer.css";

const PHONE_DISPLAY = "918 30 72 66";
const PHONE_TEL = "+34918307266";
const WHATSAPP = "34696173094";
const WHATSAPP_DISPLAY = "+34 696 17 30 94";
const ADDRESS_LINE_1 = "C. Ferrocarril, 16, Edificio 12 Nave 4";
const ADDRESS_LINE_2 = "28880 Meco, Madrid";

export default function Footer() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const waLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    "Hola, tengo una consulta sobre los productos Ecoandes."
  )}`;

  const subscribe = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error(t("newsletter.invalid"));
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post("/newsletter/subscribe", { email: value });
      toast.success(data.already ? t("newsletter.already") : t("newsletter.success"));
      setEmail("");
    } catch {
      toast.error(t("newsletter.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="eco-footer" data-testid="eco-footer">
      {/* ---- 5.1 Newsletter (ancho completo, verde corporativo) ---- */}
      <section className="eco-footer__newsletter" data-testid="footer-newsletter" aria-labelledby="footer-news-title">
        <div className="eco-footer__container eco-footer__newsletter-inner">
          <div>
            <h3 id="footer-news-title" className="eco-footer__newsletter-title font-heading">
              {t("footer.joinCommunity", "\u00danete a la comunidad EcoAndes")}
            </h3>
            <p className="eco-footer__newsletter-sub">{t("newsletter.subtitle")}</p>
          </div>
          <form className="eco-footer__form" onSubmit={subscribe} aria-label={t("footer.newsletterTitle", "Newsletter")}>
            <input
              type="email"
              className="eco-footer__input"
              placeholder={t("newsletter.placeholder", "Tu email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={t("newsletter.placeholder", "Tu email")}
              required
              data-testid="footer-newsletter-input"
            />
            <button type="submit" className="eco-footer__submit" disabled={sending} aria-label={t("newsletter.cta", "Suscribirme")} data-testid="footer-newsletter-submit">
              {sending ? "\u2026" : t("newsletter.cta", "Suscribirme")}
            </button>
          </form>
        </div>
      </section>

      {/* ---- 5.2 Bloque principal: navegación y contacto ---- */}
      <section className="eco-footer__main" aria-label={t("footer.mainNav", "Informaci\u00f3n y enlaces")}>
        <div className="eco-footer__container eco-footer__grid">
          {/* Columna 1 · Marca */}
          <div data-testid="footer-brand">
            <img src="/logo-ecoandes.png" alt="EcoAndes · Organic Ingredients" className="eco-footer__logo" loading="lazy" decoding="async" />
            <p className="eco-footer__tagline">{t("footer.tagline")}</p>
            <ul className="eco-footer__contact">
              <li>
                <a href={WAREHOUSE_MAPS_URL} target="_blank" rel="noopener noreferrer" data-testid="footer-address" aria-label="Dirección principal EcoAndes en Google Maps">
                  <MapPin size={15} />
                  <span>{ADDRESS_LINE_1}<br />{ADDRESS_LINE_2}</span>
                </a>
              </li>
              <li>
                <a href="mailto:info@productosecoandes.com" data-testid="footer-email" aria-label="Enviar email a EcoAndes">
                  <Mail size={15} /> info@productosecoandes.com
                </a>
              </li>
              <li>
                <a href={`tel:${PHONE_TEL}`} data-testid="footer-phone" aria-label="Llamar a EcoAndes">
                  <Phone size={15} /> {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={waLink} target="_blank" rel="noopener noreferrer" data-testid="footer-whatsapp" aria-label="Abrir WhatsApp de EcoAndes">
                  <MessageCircle size={15} /> WhatsApp {WHATSAPP_DISPLAY}
                </a>
              </li>
            </ul>
            <ul className="eco-footer__socials" data-testid="footer-socials">
              <li>
                <a href="https://www.facebook.com/EcoandesBio" target="_blank" rel="noopener noreferrer" className="eco-footer__social" aria-label="Facebook de EcoAndes" data-testid="footer-facebook">
                  <Facebook size={16} />
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/ecoandesbio" target="_blank" rel="noopener noreferrer" className="eco-footer__social" aria-label="Instagram de EcoAndes" data-testid="footer-instagram">
                  <Instagram size={16} />
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/ecoandes-import-export-s-l-" target="_blank" rel="noopener noreferrer" className="eco-footer__social" aria-label="LinkedIn de EcoAndes" data-testid="footer-linkedin">
                  <Linkedin size={16} />
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 2 · Tienda */}
          <nav aria-label={t("footer.shop", "Tienda")} data-testid="footer-col-shop">
            <h4 className="eco-footer__heading">{t("footer.shop")}</h4>
            <ul className="eco-footer__links">
              <li><Link to="/tienda" data-testid="footer-link-shop">{t("footer.catalog")}</Link></li>
              <li><Link to="/profesional" data-testid="footer-link-pro">{t("footer.proAccount")}</Link></li>
              <li><Link to="/blog" data-testid="footer-link-blog">{t("footer.ourBlog")}</Link></li>
              <li><Link to="/certificaciones" data-testid="footer-link-cert">{t("footer.certifications")}</Link></li>
              <li><Link to="/sobre-nosotros" data-testid="footer-link-about">{t("footer.about")}</Link></li>
            </ul>
          </nav>

          {/* Columna 3 · Área de clientes */}
          <nav aria-label={t("footer.customerArea", "\u00c1rea de clientes")} data-testid="footer-col-customers">
            <h4 className="eco-footer__heading">{t("footer.customerArea")}</h4>
            <ul className="eco-footer__links">
              <li><Link to="/cuenta" data-testid="footer-link-account">{t("footer.myAccount")}</Link></li>
              <li><Link to="/cuenta" data-testid="footer-link-orders">{t("footer.myOrders")}</Link></li>
              <li><Link to="/lista-deseos" data-testid="footer-link-wishlist">{t("footer.wishlist")}</Link></li>
              <li><Link to="/atencion-cliente" data-testid="footer-link-returns">{t("footer.returns")}</Link></li>
              <li><Link to="/atencion-cliente" data-testid="footer-link-cs">{t("footer.customerService")}</Link></li>
              <li><Link to="/contacto" data-testid="footer-link-contact">{t("footer.contact")}</Link></li>
            </ul>
          </nav>

          {/* Columna 4 · Tienda física y horarios */}
          <div data-testid="footer-store">
            <h4 className="eco-footer__heading">{t("store.name")}</h4>
            <a
              href={STORE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="eco-footer__store-address"
              data-testid="footer-store-address"
              aria-label="Tienda física EcoAndes en Google Maps"
            >
              <MapPin size={15} />
              <span>
                {STORE.market}<br />
                {STORE.addressLine1}<br />
                {STORE.addressLine2}<br />
                {STORE.addressLine3}
              </span>
            </a>
            <h4 className="eco-footer__heading">{t("store.hoursTitle")}</h4>
            <ul className="eco-footer__hours" data-testid="footer-store-hours">
              {STORE_HOURS.map((h) => (
                <li key={h.dayKey}>
                  <span className="eco-footer__day">{t(`hours.days.${h.dayKey}`)}</span>
                  <span className={h.closed ? "eco-footer__time eco-footer__time--closed" : "eco-footer__time"}>
                    {h.closed ? t("hours.closed") : h.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- 5.3 Barra inferior ---- */}
      <section className="eco-footer__bottom" aria-label={t("footer.legalInfo", "Informaci\u00f3n legal")}>
        <div className="eco-footer__container eco-footer__bottom-inner">
          <p className="eco-footer__copyright" data-testid="footer-copyright">
            © {new Date().getFullYear()} Productos EcoAndes S.L.
          </p>
          <ul className="eco-footer__legal" data-testid="footer-legal-links">
            <li><Link to="/legal/aviso-legal" data-testid="footer-link-aviso">{t("footer.legalNotice")}</Link></li>
            <li><Link to="/legal/politica-cookies" data-testid="footer-link-cookies">{t("footer.cookiePolicy")}</Link></li>
            <li><Link to="/legal/politica-privacidad" data-testid="footer-link-privacy">{t("footer.privacyPolicy")}</Link></li>
            <li><Link to="/legal/condiciones" data-testid="footer-link-terms">{t("footer.terms")}</Link></li>
          </ul>
        </div>
      </section>
    </footer>
  );
}
