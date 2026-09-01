"""Resend email sender."""
import asyncio
import logging
from typing import Optional

import resend

from core.config import RESEND_API_KEY, SENDER_EMAIL, ADMIN_NOTIFICATION_EMAIL, STORE_NOTIFICATION_EMAIL

logger = logging.getLogger(__name__)


def _order_email_html(order: dict) -> str:
    rows = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #EAE6DF;">
            <div style="color:#2D332F;font-size:14px;">{it.get('name', '')}{' · ' + it['variation_name'] if it.get('variation_name') else ''}</div>
            <div style="color:#606962;font-size:12px;">SKU: {it.get('sku', '')}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #EAE6DF;text-align:right;color:#2D332F;font-size:14px;">
            {it.get('quantity', 0)} × {it.get('unit_price', 0):.2f} €
          </td>
        </tr>
        """
        for it in order.get("items", [])
    )
    addr = order.get("shipping_address", {}) or {}
    awaiting_quote = order.get("payment_status") == "awaiting_quote" or order.get("status") == "Pendiente portes"
    shipping_display = (
        "Pendiente de presupuesto" if awaiting_quote else f"{order.get('shipping_cost', 0):.2f} €"
    )
    intro_text = (
        f"Hemos recibido tu pedido <strong>#{order.get('order_number', '')}</strong>. "
        "Los portes para tu destino se calculan según peso, volumen y destino: nuestra administración "
        "revisará el pedido y te enviaremos un correo con el importe total (portes incluidos) para realizar el pago."
        if awaiting_quote
        else f"Hemos recibido tu pedido <strong>#{order.get('order_number', '')}</strong>. Pronto recibirás otro email cuando sea enviado."
    )
    total_label = "Total (sin portes)" if awaiting_quote else "Total"
    return f"""
    <div style="font-family:Manrope,Arial,sans-serif;background:#F9F8F6;padding:40px 20px;color:#2D332F;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;padding:40px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-family:Outfit,Arial,sans-serif;font-size:28px;letter-spacing:0.12em;color:#2D332F;font-weight:300;">ECOANDES</div>
          <div style="color:#6B826E;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin-top:4px;">Natural · BIO</div>
        </div>
        <h2 style="font-family:Outfit,Arial,sans-serif;font-weight:300;color:#2D332F;margin:24px 0 8px;">Gracias por tu pedido</h2>
        <p style="color:#606962;font-size:14px;line-height:1.6;">
          {intro_text}
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:24px;">
          {rows}
        </table>
        <table style="width:100%;margin-top:16px;">
          <tr><td style="color:#606962;font-size:13px;padding:4px 0;">Subtotal</td>
              <td style="text-align:right;font-size:13px;color:#2D332F;">{order.get('subtotal', 0):.2f} €</td></tr>
          <tr><td style="color:#606962;font-size:13px;padding:4px 0;">Envío</td>
              <td style="text-align:right;font-size:13px;color:#2D332F;">{shipping_display}</td></tr>
          <tr><td style="color:#2D332F;font-size:16px;padding:12px 0;border-top:1px solid #EAE6DF;"><strong>{total_label}</strong></td>
              <td style="text-align:right;font-size:16px;color:#2D332F;border-top:1px solid #EAE6DF;padding:12px 0;"><strong>{order.get('total', 0):.2f} €</strong></td></tr>
        </table>
        <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;color:#2D332F;margin-top:32px;">Envío a</h3>
        <p style="color:#606962;font-size:13px;line-height:1.6;">
          {addr.get('full_name', '')}<br/>
          {addr.get('street', '')}<br/>
          {addr.get('postal_code', '')} {addr.get('city', '')}, {addr.get('province', '')}<br/>
          {addr.get('country', '')}
        </p>
        <p style="color:#9BA39D;font-size:11px;text-align:center;margin-top:40px;letter-spacing:0.1em;">
          Ecoandes · Productos ecológicos de los Andes
        </p>
      </div>
    </div>
    """


async def send_order_confirmation(order: dict) -> Optional[str]:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; skipping order email.")
        return None
    resend.api_key = RESEND_API_KEY
    recipients = [order["email"]]
    params = {
        "from": SENDER_EMAIL,
        "to": recipients,
        "subject": f"Confirmación de pedido #{order.get('order_number', '')} · Ecoandes",
        "html": _order_email_html(order),
    }
    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        return resp.get("id") if isinstance(resp, dict) else None
    except Exception as e:
        logger.exception("Failed to send order email: %s", e)
        return None


def _pickup_email_html(order: dict) -> str:
    rows = "".join(
        f"""
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #EAE6DF;color:#2D332F;font-size:14px;">
            {it.get('name', '')}{' · ' + it['variation_name'] if it.get('variation_name') else ''}
            <span style="color:#9BA39D;"> (SKU: {it.get('sku', '')})</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #EAE6DF;text-align:right;color:#2D332F;font-size:14px;">
            x{it.get('quantity', 0)}
          </td>
        </tr>
        """
        for it in order.get("items", [])
    )
    addr = order.get("shipping_address", {}) or {}
    return f"""
    <div style="font-family:Manrope,Arial,sans-serif;background:#F9F8F6;padding:32px 20px;color:#2D332F;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;padding:36px;border-top:4px solid #6B826E;">
        <div style="color:#6B826E;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Recogida en tienda</div>
        <h2 style="font-family:Outfit,Arial,sans-serif;font-weight:400;color:#2D332F;margin:8px 0 4px;">Nuevo pedido para recoger</h2>
        <p style="color:#606962;font-size:14px;line-height:1.6;">
          Pedido <strong>#{order.get('order_number', '')}</strong> pagado por adelantado.
          El cliente pasará a recogerlo por la tienda.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">{rows}</table>
        <table style="width:100%;margin-top:12px;">
          <tr><td style="color:#2D332F;font-size:15px;padding:10px 0;border-top:1px solid #EAE6DF;"><strong>Total pagado</strong></td>
              <td style="text-align:right;font-size:15px;color:#2D332F;border-top:1px solid #EAE6DF;padding:10px 0;"><strong>{order.get('total', 0):.2f} €</strong></td></tr>
        </table>
        <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;color:#2D332F;margin-top:24px;">Datos del cliente</h3>
        <p style="color:#606962;font-size:13px;line-height:1.6;">
          {addr.get('full_name', '')}<br/>
          {('Tel: ' + addr.get('phone')) if addr.get('phone') else ''}<br/>
          Email: {order.get('email', '')}
        </p>
      </div>
    </div>
    """


async def send_pickup_notification(order: dict) -> Optional[str]:
    """Notify the physical store that a paid pickup order is ready to prepare."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; skipping pickup notification.")
        return None
    if not STORE_NOTIFICATION_EMAIL:
        logger.warning("STORE_NOTIFICATION_EMAIL not configured; skipping pickup notification.")
        return None
    resend.api_key = RESEND_API_KEY
    params = {
        "from": SENDER_EMAIL,
        "to": [STORE_NOTIFICATION_EMAIL],
        "subject": f"🛍️ Recogida en tienda · Pedido #{order.get('order_number', '')} · Ecoandes",
        "html": _pickup_email_html(order),
    }
    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        return resp.get("id") if isinstance(resp, dict) else None
    except Exception as e:
        logger.exception("Failed to send pickup notification: %s", e)
        return None



# ---------- Generic branded wrapper ----------
def _wrap(title: str, body_html: str, accent: str = "#72A638") -> str:
    """Plantilla base de todos los correos, con la identidad de marca EcoAndes
    (verde #72A638, tonos bone/sage, botones pill y footer completo)."""
    return f"""
    <div style="font-family:Manrope,'Segoe UI',Arial,sans-serif;background:#F4F2EC;padding:32px 16px;color:#2D332F;">
      <div style="max-width:600px;margin:0 auto;">

        <!-- Cabecera de marca -->
        <div style="background:{accent};border-radius:14px 14px 0 0;padding:26px 32px;text-align:center;">
          <div style="font-family:Outfit,Arial,sans-serif;font-size:27px;letter-spacing:0.16em;color:#FFFFFF;font-weight:600;">
            ECO<span style="font-weight:300;">ANDES</span>
          </div>
          <div style="color:#EAF3DD;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;margin-top:5px;">
            Organic Ingredients · BIO
          </div>
        </div>

        <!-- Cuerpo -->
        <div style="background:#FFFFFF;padding:34px 32px 30px;border:1px solid #E7E3D8;border-top:none;">
          <h2 style="font-family:Outfit,Arial,sans-serif;font-weight:500;color:#2D332F;font-size:21px;margin:0 0 14px;line-height:1.35;">
            {title}
          </h2>
          {body_html}
        </div>

        <!-- Banda de confianza -->
        <div style="background:#F7FAF2;border:1px solid #E1EAD3;border-top:none;padding:14px 32px;text-align:center;">
          <span style="color:#4A6B4D;font-size:11px;letter-spacing:0.06em;">
            🌱 Certificación ecológica europea &nbsp;·&nbsp; 🚚 Envío gratis desde 50 € &nbsp;·&nbsp; 🔒 Pago 100% seguro
          </span>
        </div>

        <!-- Footer -->
        <div style="background:#2D332F;border-radius:0 0 14px 14px;padding:22px 32px;text-align:center;">
          <div style="color:#C9D3C5;font-size:12px;line-height:1.8;">
            <strong style="color:#FFFFFF;">EcoAndes · Productos ecológicos de los Andes</strong><br/>
            Mercado Barceló · C. de Barceló, 6 · Local 204 · 28004 Madrid<br/>
            <a href="https://productosecoandes.com" style="color:#A9CB7E;text-decoration:none;">productosecoandes.com</a>
          </div>
          <div style="color:#6E766F;font-size:10px;margin-top:12px;letter-spacing:0.08em;">
            © EcoAndes · Compra salud, compra BIO
          </div>
        </div>

      </div>
    </div>
    """


async def _send(to: str, subject: str, html: str) -> Optional[str]:
    """Low-level send helper. No-op (logged) when RESEND_API_KEY is missing."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; skipping email to %s (%s)", to, subject)
        return None
    if not to:
        return None
    resend.api_key = RESEND_API_KEY
    params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        return resp.get("id") if isinstance(resp, dict) else None
    except Exception as e:  # noqa: BLE001
        logger.exception("Failed to send email (%s): %s", subject, e)
        return None


# ---------- Mensaje personalizado de EcoAndes al cliente (desde admin) ----------
async def send_custom_customer_message(order: dict, subject: Optional[str], message: str) -> Optional[str]:
    """Envía un mensaje personalizado al correo del cliente con la plantilla de marca."""
    from html import escape as _esc

    order_no = order.get("order_number", "")
    addr = order.get("shipping_address", {}) or {}
    name = (addr.get("full_name") or "").split(" ")[0] or "cliente"
    subj = (subject or "").strip() or f"Mensaje de EcoAndes sobre tu pedido #{order_no}"
    safe = _esc(message).replace("\n", "<br/>")
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">Hola {_esc(name)},</p>
      <div style="margin-top:10px;padding:16px 18px;background:#F4F6F2;border-left:3px solid #72A638;color:#2D332F;font-size:14px;line-height:1.7;">
        {safe}
      </div>
      <p style="color:#9AA39C;font-size:12px;line-height:1.6;margin-top:16px;">
        Referencia: pedido <strong>#{order_no}</strong>. Si tienes cualquier duda, responde a este correo
        o escríbenos a través de la web.
      </p>
    """
    return await _send(order.get("email"), subj, _wrap("Mensaje de EcoAndes", body))


# ---------- Solicitud de reembolso del cliente (aviso interno) ----------
async def send_refund_request_notice(order: dict, request: dict) -> Optional[str]:
    order_no = order.get("order_number", "")
    if request.get("full_order"):
        items_html = "<p style='color:#2D332F;font-size:14px;'><strong>Reembolso solicitado: TODO EL PEDIDO</strong></p>"
    else:
        rows = "".join(
            f"<tr><td style='padding:4px 0;color:#2D332F;font-size:13px;'>{it.get('name','')}"
            f"{' · ' + it.get('variation_name') if it.get('variation_name') else ''}</td>"
            f"<td style='text-align:right;font-size:13px;'>× {it.get('quantity',1)}</td></tr>"
            for it in request.get("items", [])
        )
        items_html = f"<table style='width:100%;border-collapse:collapse;'>{rows}</table>"
    reason_html = (
        f"<div style='margin-top:12px;padding:10px 14px;background:#F4F6F2;border-left:3px solid #B0654F;font-size:13px;color:#2D332F;'>Motivo del cliente: {request.get('reason')}</div>"
        if request.get("reason") else ""
    )
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        El cliente <strong>{order.get('email','')}</strong> ha solicitado un reembolso del pedido
        <strong>#{order_no}</strong> (total {order.get('total',0):.2f} €).
      </p>
      {items_html}
      {reason_html}
      <p style="color:#9AA39C;font-size:12px;margin-top:14px;">
        Revisa y ejecuta el reembolso desde el panel de administración → Pedidos → #{order_no}.
        El envío solo debe devolverse si el reembolso es del pedido completo.
      </p>
    """
    return await _send_company(f"🔁 Solicitud de reembolso · Pedido #{order_no}", _wrap("Solicitud de reembolso", body))


# ---------- Solicitud de factura (profesional) ----------
async def send_invoice_request_notice(order: dict, user: dict) -> Optional[str]:
    order_no = order.get("order_number", "")
    company = user.get("company") or "-"
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        El cliente profesional <strong>{user.get('first_name','')} {user.get('last_name','')}</strong>
        ({user.get('email','')}) ha solicitado la <strong>factura</strong> del pedido <strong>#{order_no}</strong>.
      </p>
      <table style="width:100%;font-size:13px;color:#2D332F;">
        <tr><td style="padding:4px 0;color:#606962;">Empresa</td><td style="text-align:right;">{company}</td></tr>
        <tr><td style="padding:4px 0;color:#606962;">NIF/CIF</td><td style="text-align:right;">{user.get('tax_id') or '-'}</td></tr>
        <tr><td style="padding:4px 0;color:#606962;">Total pedido</td><td style="text-align:right;">{order.get('total',0):.2f} €</td></tr>
        <tr><td style="padding:4px 0;color:#606962;">Fecha pedido</td><td style="text-align:right;">{(order.get('created_at') or '')[:10]}</td></tr>
      </table>
      <p style="color:#9AA39C;font-size:12px;margin-top:14px;">Emite la factura y envíasela al cliente por email.</p>
    """
    return await _send_company(f"🧾 Solicitud de factura · Pedido #{order_no}", _wrap("Solicitud de factura", body))


# ---------- Professional account: under review ----------
async def send_professional_review(user: dict) -> Optional[str]:
    name = user.get("first_name", "")
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Hola {name}, hemos recibido tu solicitud para acceder como <strong>profesional (B2B)</strong>
        en EcoAndes.
      </p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Tu petición está siendo revisada por nuestro equipo. En un plazo de
        <strong>24 horas</strong> validaremos tu cuenta y te avisaremos por email cuando
        tengas acceso a los precios y condiciones profesionales.
      </p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Mientras tanto, puedes navegar por la tienda con normalidad. Gracias por tu confianza.
      </p>
    """
    return await _send(user.get("email"), "Tu solicitud profesional está en revisión · Ecoandes",
                       _wrap("Solicitud en revisión", body))


async def send_professional_approved(user: dict) -> Optional[str]:
    name = user.get("first_name", "")
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        ¡Buenas noticias, {name}! Tu cuenta <strong>profesional (B2B)</strong> ha sido
        <strong style="color:#6B826E;">aprobada</strong>.
      </p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Ya puedes iniciar sesión y disfrutar de los precios y condiciones profesionales
        en toda la tienda.
      </p>
    """
    return await _send(user.get("email"), "Tu cuenta profesional ha sido aprobada · Ecoandes",
                       _wrap("Cuenta aprobada", body))


# ---------- Refund notification ----------
async def send_refund_notification(order: dict, refund: dict) -> Optional[str]:
    addr = order.get("shipping_address", {}) or {}
    name = addr.get("full_name", "")
    reason = refund.get("reason", "")
    amount = float(refund.get("amount", order.get("total", 0)) or 0)
    method = refund.get("provider") or order.get("payment_method", "")
    manual = refund.get("manual")
    method_line = (
        "El importe se devolverá manualmente a tu método de pago original."
        if manual else
        f"El reembolso se ha procesado a través de {method}. Puede tardar unos días en reflejarse."
    )
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Hola {name}, te confirmamos el <strong>reembolso</strong> de tu pedido
        <strong>#{order.get('order_number', '')}</strong>.
      </p>
      <table style="width:100%;margin-top:16px;border-collapse:collapse;">
        <tr><td style="color:#606962;font-size:13px;padding:6px 0;">Importe reembolsado</td>
            <td style="text-align:right;font-size:15px;color:#2D332F;"><strong>{amount:.2f} €</strong></td></tr>
        <tr><td style="color:#606962;font-size:13px;padding:6px 0;border-top:1px solid #EAE6DF;">Motivo</td>
            <td style="text-align:right;font-size:13px;color:#2D332F;border-top:1px solid #EAE6DF;">{reason}</td></tr>
      </table>
      <p style="color:#606962;font-size:14px;line-height:1.7;margin-top:16px;">{method_line}</p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">Lamentamos las molestias y gracias por tu comprensión.</p>
    """
    return await _send(order.get("email"), f"Reembolso de tu pedido #{order.get('order_number','')} · Ecoandes",
                       _wrap("Reembolso procesado", body, accent="#B0654F"))


# ================= Notificaciones internas a la empresa =================
def _company_recipients() -> list:
    """ADMIN_NOTIFICATION_EMAIL admite varias direcciones separadas por comas."""
    return [e.strip() for e in (ADMIN_NOTIFICATION_EMAIL or "").split(",") if e.strip()]


async def _send_company(subject: str, html: str) -> Optional[str]:
    recipients = _company_recipients()
    if not recipients:
        logger.warning("ADMIN_NOTIFICATION_EMAIL no configurado; se omite: %s", subject)
        return None
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY no configurada; se omite: %s", subject)
        return None
    resend.api_key = RESEND_API_KEY
    params = {"from": SENDER_EMAIL, "to": recipients, "subject": subject, "html": html}
    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        return resp.get("id") if isinstance(resp, dict) else None
    except Exception as e:  # noqa: BLE001
        logger.exception("Fallo enviando email interno (%s): %s", subject, e)
        return None


# ---------- Registro: bienvenida al cliente ----------
async def send_registration_welcome(user: dict) -> Optional[str]:
    """Retail: registro completado. Profesional auto-verificado: cuenta activada."""
    name = user.get("first_name", "")
    if user.get("role") == "professional":
        body = f"""
          <p style="color:#606962;font-size:14px;line-height:1.7;">
            ¡Enhorabuena, {name}! Hemos verificado automáticamente los datos fiscales de
            <strong>{user.get('company', 'tu empresa')}</strong> y tu registro como
            <strong>profesional (B2B)</strong> se ha completado.
          </p>
          <p style="color:#606962;font-size:14px;line-height:1.7;">
            Ya puedes iniciar sesión y acceder a los precios y condiciones profesionales en toda la tienda.
          </p>
        """
        return await _send(user.get("email"), "Tu registro profesional se ha completado · Ecoandes",
                           _wrap("Registro profesional completado", body))
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        ¡Bienvenido/a, {name}! Tu registro en EcoAndes se ha completado correctamente.
      </p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Ya puedes iniciar sesión, guardar tus productos favoritos y realizar tus pedidos
        de ingredientes ecológicos con toda comodidad.
      </p>
    """
    return await _send(user.get("email"), "Tu registro se ha completado · Ecoandes",
                       _wrap("Registro completado", body))


async def send_registration_failed_verification(user: dict) -> Optional[str]:
    """Profesional con NIF/CIF no verificable: instrucciones para alta manual."""
    name = user.get("first_name", "")
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">Hola {name},</p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Su registro no se ha completado automáticamente por que sus datos no han podido
        ser verificados, en caso seas Autónomo o puedas justificar la veracidad de tus
        datos comunícate directamente con soporte al cliente para darte de alta de forma manual.
      </p>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Puedes escribirnos a <a href="mailto:info@productosecoandes.com" style="color:#6B826E;">info@productosecoandes.com</a>
        o contactarnos por WhatsApp desde la web.
      </p>
    """
    return await _send(user.get("email"), "Tu registro necesita verificación manual · Ecoandes",
                       _wrap("Verificación pendiente", body, accent="#B0654F"))


# ---------- Registro: aviso interno a la empresa ----------
async def send_company_registration_notice(user: dict, verification: str) -> Optional[str]:
    status_line = {
        "auto": ("✅ Verificado automáticamente (BeeL/AEAT)", "#6B826E"),
        "manual": ("🕐 NECESITA VERIFICACIÓN MANUAL (validar en 24 h)", "#C2A878"),
        "failed": ("❌ Verificación fallida: NIF/CIF no válido. El cliente debe contactar con soporte.", "#B0654F"),
        "retail": ("✅ Cliente retail: alta automática", "#6B826E"),
    }.get(verification, (verification, "#6B826E"))
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Nuevo registro en la web:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#2D332F;">
        <tr><td style="padding:5px 0;color:#606962;">Nombre</td><td style="text-align:right;">{user.get('first_name','')} {user.get('last_name','')}</td></tr>
        <tr><td style="padding:5px 0;color:#606962;">Email</td><td style="text-align:right;">{user.get('email','')}</td></tr>
        <tr><td style="padding:5px 0;color:#606962;">Teléfono</td><td style="text-align:right;">{user.get('phone','') or '—'}</td></tr>
        <tr><td style="padding:5px 0;color:#606962;">Tipo</td><td style="text-align:right;">{'Profesional (B2B)' if user.get('role') == 'professional' else 'Retail (B2C)'}</td></tr>
        {f"<tr><td style='padding:5px 0;color:#606962;'>Empresa</td><td style='text-align:right;'>{user.get('company','')}</td></tr>" if user.get('company') else ''}
        {f"<tr><td style='padding:5px 0;color:#606962;'>NIF/CIF</td><td style='text-align:right;'>{user.get('tax_id','')}</td></tr>" if user.get('tax_id') else ''}
        {f"<tr><td style='padding:5px 0;color:#606962;'>Actividad</td><td style='text-align:right;'>{user.get('business_type','')}</td></tr>" if user.get('business_type') else ''}
      </table>
      {f'''<div style="margin-top:14px;padding:12px 14px;background:#F4F6F2;border-left:3px solid #6B826E;">
        <div style="color:#6B826E;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Mensaje del cliente</div>
        <div style="color:#2D332F;font-size:13px;line-height:1.6;">{user.get('message','')}</div>
      </div>''' if user.get('message') else ''}
      <p style="color:{status_line[1]};font-size:14px;line-height:1.6;margin-top:14px;"><strong>{status_line[0]}</strong></p>
    """
    tag = "B2B" if user.get("role") == "professional" else "Retail"
    return await _send_company(f"👤 Nuevo registro {tag}: {user.get('email','')} · Ecoandes",
                               _wrap("Nuevo registro de cliente", body))


# ---------- Pedidos: aviso interno a la empresa ----------
async def send_company_order_notice(order: dict) -> Optional[str]:
    addr = order.get("shipping_address", {}) or {}
    rows = "".join(
        f"<tr><td style='padding:6px 0;border-bottom:1px solid #EAE6DF;font-size:13px;color:#2D332F;'>{it.get('name','')}{' · ' + it['variation_name'] if it.get('variation_name') else ''} <span style='color:#9BA39D;'>({it.get('sku','')})</span></td>"
        f"<td style='padding:6px 0;border-bottom:1px solid #EAE6DF;text-align:right;font-size:13px;color:#2D332F;'>{it.get('quantity',0)} × {it.get('unit_price',0):.2f} €</td></tr>"
        for it in order.get("items", [])
    )
    acq = order.get("acquisition") or {}
    awaiting_quote = order.get("payment_status") == "awaiting_quote" or order.get("status") == "Pendiente portes"
    quote_alert = (
        """<p style="color:#B0654F;font-size:14px;line-height:1.6;margin-top:14px;">
        <strong>⚠️ PEDIDO PENDIENTE DE PRESUPUESTO DE PORTES</strong><br/>
        Destino fuera de península (Canarias u otro destino). Calcula los portes según peso, volumen y
        destino, fíjalos en el panel de administración y envía manualmente al cliente el correo con el
        importe total para que realice el pago.</p>"""
        if awaiting_quote else ""
    )
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Se ha recibido un nuevo pedido <strong>#{order.get('order_number','')}</strong>.
      </p>
      {quote_alert}
      <table style="width:100%;border-collapse:collapse;">{rows}</table>
      <table style="width:100%;margin-top:12px;font-size:13px;color:#2D332F;">
        <tr><td style="color:#606962;padding:4px 0;">Total</td><td style="text-align:right;"><strong>{order.get('total',0):.2f} €{' (sin portes)' if awaiting_quote else ''}</strong></td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Pago</td><td style="text-align:right;">{order.get('payment_method','')} · {order.get('payment_status','')}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Cliente</td><td style="text-align:right;">{addr.get('full_name','')} ({order.get('email','')})</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Tipo</td><td style="text-align:right;">{'Profesional (B2B)' if order.get('customer_type') == 'professional' else 'Retail (B2C)'}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Entrega</td><td style="text-align:right;">{'Recogida en tienda' if order.get('delivery_method') == 'pickup' else 'Envío a domicilio'}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Origen</td><td style="text-align:right;">{acq.get('source','desconocido')}</td></tr>
      </table>
    """
    return await _send_company(f"🛒 Nuevo pedido #{order.get('order_number','')} · {order.get('total',0):.2f} € · Ecoandes",
                               _wrap("Nuevo pedido recibido", body))


# ---------- Reembolsos: aviso interno ----------
async def send_company_refund_notice(order: dict, refund: dict) -> Optional[str]:
    amount = float(refund.get("amount", order.get("total", 0)) or 0)
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Se ha procesado un <strong>reembolso</strong>:
      </p>
      <table style="width:100%;font-size:13px;color:#2D332F;">
        <tr><td style="color:#606962;padding:4px 0;">Pedido</td><td style="text-align:right;">#{order.get('order_number','')}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Cliente</td><td style="text-align:right;">{order.get('email','')}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Importe</td><td style="text-align:right;"><strong>{amount:.2f} €</strong></td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Motivo</td><td style="text-align:right;">{refund.get('reason','')}</td></tr>
        <tr><td style="color:#606962;padding:4px 0;">Método</td><td style="text-align:right;">{refund.get('provider') or order.get('payment_method','')}{' (manual)' if refund.get('manual') else ''}</td></tr>
      </table>
    """
    return await _send_company(f"↩️ Reembolso pedido #{order.get('order_number','')} · {amount:.2f} € · Ecoandes",
                               _wrap("Reembolso procesado", body, accent="#B0654F"))


# ---------- Reporte diario de estadísticas ----------
async def send_daily_report() -> Optional[str]:
    """Estadísticas de las últimas 24 h: visitas, fuentes, pedidos, registros."""
    from datetime import datetime, timedelta, timezone

    from core.config import db

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=1)).isoformat()
    date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    date_to = now.strftime("%Y-%m-%d")

    v_match = {"date": {"$gte": date_from, "$lte": date_to}, "ts": {"$gte": since}}
    pageviews = await db.visits.count_documents(v_match)
    sessions = len(await db.visits.distinct("session_id", v_match))
    sources = []
    async for r in db.visits.aggregate([
        {"$match": v_match},
        {"$group": {"_id": "$source", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 6},
    ]):
        sources.append((r["_id"], r["n"]))
    countries = []
    async for r in db.visits.aggregate([
        {"$match": {**v_match, "country_code": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$country_code", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 6},
    ]):
        countries.append((r["_id"], r["n"]))

    o_match = {"created_at": {"$gte": since}}
    orders_count = await db.orders.count_documents(o_match)
    revenue = 0.0
    async for r in db.orders.aggregate([
        {"$match": o_match}, {"$group": {"_id": None, "t": {"$sum": "$total"}}},
    ]):
        revenue = r.get("t", 0.0)
    paid_revenue = 0.0
    async for r in db.orders.aggregate([
        {"$match": {**o_match, "payment_status": "paid"}},
        {"$group": {"_id": None, "t": {"$sum": "$total"}}},
    ]):
        paid_revenue = r.get("t", 0.0)
    recent_orders = await db.orders.find(o_match, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)

    new_users = await db.users.find({"created_at": {"$gte": since}}, {"_id": 0, "password_hash": 0}).to_list(50)
    pending_pros = await db.users.count_documents({"role": "professional", "approved": False})

    src_rows = "".join(
        f"<tr><td style='padding:3px 0;color:#606962;font-size:13px;'>{s}</td><td style='text-align:right;font-size:13px;color:#2D332F;'>{n}</td></tr>"
        for s, n in sources
    ) or "<tr><td style='color:#9BA39D;font-size:13px;'>Sin visitas registradas</td></tr>"
    country_rows = "".join(
        f"<tr><td style='padding:3px 0;color:#606962;font-size:13px;'>{c}</td><td style='text-align:right;font-size:13px;color:#2D332F;'>{n}</td></tr>"
        for c, n in countries
    ) or "<tr><td style='color:#9BA39D;font-size:13px;'>—</td></tr>"
    order_rows = "".join(
        f"<tr><td style='padding:3px 0;color:#606962;font-size:13px;'>#{o.get('order_number','')} · {o.get('email','')}</td>"
        f"<td style='text-align:right;font-size:13px;color:#2D332F;'>{o.get('total',0):.2f} € · {o.get('status','')}</td></tr>"
        for o in recent_orders
    ) or "<tr><td style='color:#9BA39D;font-size:13px;'>Sin pedidos en las últimas 24 h</td></tr>"
    user_rows = "".join(
        f"<tr><td style='padding:3px 0;color:#606962;font-size:13px;'>{u.get('email','')}</td>"
        f"<td style='text-align:right;font-size:13px;color:#2D332F;'>{'B2B' if u.get('role') == 'professional' else 'Retail'}{'' if u.get('approved') else ' · pendiente'}</td></tr>"
        for u in new_users
    ) or "<tr><td style='color:#9BA39D;font-size:13px;'>Sin registros nuevos</td></tr>"

    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Resumen de actividad de las últimas 24 horas:
      </p>
      <table style="width:100%;margin:10px 0;font-size:14px;color:#2D332F;">
        <tr><td style="color:#606962;padding:5px 0;">Visitas (páginas)</td><td style="text-align:right;"><strong>{pageviews}</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Sesiones</td><td style="text-align:right;"><strong>{sessions}</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Pedidos</td><td style="text-align:right;"><strong>{orders_count}</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Facturación (total)</td><td style="text-align:right;"><strong>{revenue:.2f} €</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Facturación (pagada)</td><td style="text-align:right;"><strong>{paid_revenue:.2f} €</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Registros nuevos</td><td style="text-align:right;"><strong>{len(new_users)}</strong></td></tr>
        <tr><td style="color:#606962;padding:5px 0;">Profesionales pendientes de aprobar</td><td style="text-align:right;"><strong>{pending_pros}</strong></td></tr>
      </table>
      <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;margin:18px 0 6px;color:#2D332F;">Fuentes de tráfico</h3>
      <table style="width:100%;">{src_rows}</table>
      <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;margin:18px 0 6px;color:#2D332F;">Países</h3>
      <table style="width:100%;">{country_rows}</table>
      <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;margin:18px 0 6px;color:#2D332F;">Pedidos</h3>
      <table style="width:100%;">{order_rows}</table>
      <h3 style="font-family:Outfit,Arial,sans-serif;font-weight:400;margin:18px 0 6px;color:#2D332F;">Actividad de clientes registrados</h3>
      <table style="width:100%;">{user_rows}</table>
    """
    from datetime import datetime as _dt
    return await _send_company(f"📊 Reporte diario EcoAndes · {_dt.now().strftime('%d/%m/%Y')}",
                               _wrap("Reporte diario de estadísticas", body))


async def send_newsletter_welcome(email: str) -> Optional[str]:
    """Bienvenida automática a los nuevos suscriptores de la newsletter."""
    body = """
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        ¡Gracias por unirte a la comunidad <strong>EcoAndes</strong>! A partir de ahora
        recibirás en tu correo recetas saludables, novedades BIO y ofertas exclusivas
        antes que nadie.
      </p>
      <div style="background:#F4F7F0;border:1px solid #DCE8D2;border-radius:8px;padding:16px 18px;margin:18px 0;">
        <p style="color:#4A6B4D;font-size:13px;line-height:1.7;margin:0;">
          🌱 <strong>Tu regalo de bienvenida:</strong> usa el cupón <strong>ECOBONUS</strong>
          y consigue <strong>5 € de descuento</strong> en tu primer pedido (compra mínima 60 €).
        </p>
      </div>
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        Descubre nuestros superalimentos, semillas, harinas y legumbres ecológicas a granel,
        con certificación ecológica europea y directas de su país de origen.
      </p>
      <div style="text-align:center;margin:26px 0 6px;">
        <a href="https://productosecoandes.com/tienda"
           style="background:#72A638;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;">
          Explorar la tienda
        </a>
      </div>
      <p style="color:#9BA39D;font-size:11px;line-height:1.6;margin-top:22px;">
        Recibes este correo porque te has suscrito a la newsletter de EcoAndes. Si no has sido
        tú, puedes ignorar este mensaje o escribirnos para darte de baja.
      </p>
    """
    return await _send(email, "🌿 Bienvenido/a a EcoAndes · Tu 5 € de regalo te espera",
                       _wrap("¡Bienvenido/a a EcoAndes!", body))


async def send_abandoned_cart_email(cart: dict, second: bool = False) -> Optional[str]:
    """Recordatorio de carrito abandonado (con cupón ECOBONUS).

    second=True -> 2º y último aviso (24 h), con tono de última oportunidad.
    """
    items = cart.get("items") or []
    rows = "".join(
        f"""
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #EDEBE4;color:#3A403B;font-size:13px;">
            {i.get('name', '')}{(' · ' + i['variation_name']) if i.get('variation_name') else ''}
            <span style="color:#9BA39D;">× {i.get('quantity', 1)}</span>
          </td>
          <td style="padding:9px 0;border-bottom:1px solid #EDEBE4;color:#3A403B;font-size:13px;text-align:right;white-space:nowrap;">
            {(i.get('unit_price', 0) * i.get('quantity', 1)):.2f} €
          </td>
        </tr>"""
        for i in items[:10]
    )
    more = f"<p style='color:#9BA39D;font-size:12px;'>… y {len(items) - 10} producto(s) más.</p>" if len(items) > 10 else ""
    intro = (
        """Es el último aviso que te enviamos: tu carrito en <strong>EcoAndes</strong> sigue
        guardado, pero no podemos reservarte el stock para siempre. Completa tu pedido
        hoy y no te quedes sin tus productos ecológicos favoritos."""
        if second
        else """Hemos guardado tu carrito en <strong>EcoAndes</strong> para que no pierdas tu
        selección de productos ecológicos. ¡Sigue donde lo dejaste!"""
    )
    body = f"""
      <p style="color:#606962;font-size:14px;line-height:1.7;">
        {intro}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;">
        {rows}
        <tr>
          <td style="padding:10px 0;color:#3A403B;font-size:13px;font-weight:700;">Total estimado</td>
          <td style="padding:10px 0;color:#3A403B;font-size:14px;font-weight:700;text-align:right;">{cart.get('subtotal', 0):.2f} €</td>
        </tr>
      </table>
      {more}
      <div style="background:#F4F7F0;border:1px solid #DCE8D2;border-radius:8px;padding:14px 16px;margin:16px 0;">
        <p style="color:#4A6B4D;font-size:13px;line-height:1.7;margin:0;">
          🌱 ¿Es tu primer pedido? Usa el cupón <strong>ECOBONUS</strong> y consigue
          <strong>5 € de descuento</strong> (compra mínima 60 €). Y recuerda: envío
          <strong>gratis</strong> a partir de 50 €.
        </p>
      </div>
      <div style="text-align:center;margin:24px 0 6px;">
        <a href="https://productosecoandes.com/checkout"
           style="background:#72A638;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;">
          Recuperar mi carrito
        </a>
      </div>
      <p style="color:#9BA39D;font-size:11px;line-height:1.6;margin-top:20px;">
        Recibes este correo porque dejaste productos en tu carrito de EcoAndes. Si ya
        completaste tu compra, puedes ignorar este mensaje.
      </p>
    """
    subject = (
        "⏳ Último aviso: tu carrito EcoAndes está a punto de vaciarse"
        if second
        else "🛒 Tu carrito EcoAndes te espera · 5 € de regalo con ECOBONUS"
    )
    heading = "Última oportunidad para recuperar tu carrito" if second else "¿Olvidaste algo en tu carrito?"
    return await _send(cart["email"], subject, _wrap(heading, body))
