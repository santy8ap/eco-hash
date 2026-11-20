import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { PLAN_MONTHS } from "@/config/plans";
import { FARM } from "@/config/farm";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/mining/plan-math";
import { formatSats } from "@/lib/format";
import { MIN_WITHDRAWAL_SATS } from "@/lib/withdrawal-schema";
import { LegalPage, Ph, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Términos y Condiciones" };

const SECTIONS: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    body: (
      <p>
        La plataforma {BRAND.name} es operada por {LEGAL.company}, sociedad identificada con NIT <Ph>{LEGAL.nit}</Ph>, con domicilio en <Ph>{LEGAL.address}</Ph>, <Ph>{LEGAL.city}</Ph>. Puedes
        contactarnos en <Ph>{LEGAL.email}</Ph> o al <Ph>{LEGAL.phone}</Ph>.
      </p>
    ),
  },
  {
    id: "quien-puede",
    title: "Quién puede usar la plataforma",
    body: (
      <ul>
        <li>
          <strong>Clientes.</strong> Para comprar un plan debes registrar tus datos personales y aceptar estos términos.
        </li>
        <li>
          Quien registra la cuenta declara que los datos personales que entrega (nombre, documento, celular y ciudad de residencia) son verdaderos y están actualizados. Cada cliente tiene una sola cuenta.
        </li>
        <li>Se ingresa con una cuenta de Google. El cliente responde por la seguridad de esa cuenta y por lo que se haga desde ella.</li>
        <li>
          Para cumplir las normas de prevención de lavado de activos y financiación del terrorismo, podemos pedir documentos de identificación, verificar la información y suspender o rechazar operaciones cuando haya alertas.
        </li>
      </ul>
    ),
  },
  {
    id: "plan",
    title: "Qué es un plan de hashrate",
    body: (
      <>
        <p>
          Un plan es la contratación de una cantidad fija de poder de minería de Bitcoin, medida en terahashes por segundo (TH/s), en la granja de {LEGAL.company} durante {PLAN_MONTHS} meses de{" "}
          {DAYS_PER_MONTH} días. La granja opera mineros ASIC con energía de una central hidroeléctrica de pasada ({FARM.location}).
        </p>
        <ul>
          <li>Durante cada mes pagado, tu hashrate mina de forma continua, de día y de noche.</li>
          <li>
            Lo minado se calcula como tus TH/s por el <strong>hashprice</strong> del mes (sats por TH/s al día) por el tiempo transcurrido. El hashprice de cada mes queda fijo cuando se confirma su
            pago y no cambia durante ese mes.
          </li>
          <li>
            <strong>Las cifras de tu panel se calculan con esa fórmula.</strong> No son la lectura en vivo de una máquina en particular.
          </li>
        </ul>
        <p>
          La figura jurídica del plan es <Ph>[definir con el asesor legal: por ejemplo, arrendamiento de capacidad de cómputo o prestación de servicios de minería]</Ph>. Comprar un plan no te
          convierte en accionista de {LEGAL.company} ni en propietario de los equipos de la granja.
        </p>
      </>
    ),
  },
  {
    id: "precios",
    title: "Precios y minería",
    body: (
      <>
        <ul>
          <li>Cada plan tiene un precio por TH/s al mes, publicado en la tabla de planes. La mensualidad incluye la energía y el mantenimiento de los equipos.</li>
          <li>El precio por TH/s de tu plan queda fijo desde la compra y durante todo el plan, aunque después cambien los precios publicados.</li>
          <li>
            El hashprice depende de la dificultad de la red Bitcoin y de las comisiones de las transacciones, que cambian con el tiempo. Por eso cada mes mina con el hashprice vigente cuando se
            confirma su pago.
          </li>
          <li>
            <strong>La rentabilidad no está garantizada.</strong> Las estimaciones en pesos de la plataforma usan el precio del BTC del día y son solo una referencia.
          </li>
        </ul>
        <p>
          <Ph>[El asesor legal debe definir si el hashprice publicado es una obligación de {LEGAL.company} o si depende de la producción real de la granja, y redactar esta cláusula en consecuencia.]</Ph>
        </p>
      </>
    ),
  },
  {
    id: "pagos",
    title: "Pagos",
    body: (
      <>
        <p>
          Un plan se paga mes a mes y por adelantado, en pesos. Cada pago confirmado activa {DAYS_PER_MONTH} días de minería, que cuentan desde la confirmación. Si pagas el mes siguiente antes de
          que termine el actual, sus {DAYS_PER_MONTH} días empiezan cuando termina el mes en curso.
        </p>
        <ul>
          <li>
            <strong>Tarjeta, PSE y Nequi:</strong> se procesan a través de Mercado Pago, que aplica sus propios términos y sus propios límites por transacción. {BRAND.name} no recibe ni guarda los
            datos de tu tarjeta.
          </li>
          <li>
            <strong>Cripto (USDT o BNB en BNB Smart Chain):</strong> la cotización dura 20 minutos. Debes enviar al menos el monto exacto, desde la wallet conectada, a la dirección que muestra la
            plataforma y en la red BNB Smart Chain. Las transacciones en blockchain son irreversibles: un envío por otra red, a otra dirección o por un monto menor puede perderse o requerir una
            gestión manual que no podemos garantizar.
          </li>
          <li>
            <strong>Transferencia bancaria (cuando está disponible):</strong> la plataforma te muestra la cuenta de {LEGAL.company}, el valor exacto del mes y una referencia que debes escribir en la
            descripción de la transferencia. El mes se activa cuando nuestro equipo confirma el dinero en el banco, no cuando haces la transferencia.
          </li>
          <li>
            <strong>Pago registrado por nuestro equipo:</strong> si acordamos contigo otro medio, nuestro equipo registra el pago con la referencia del comprobante y el mes se activa en ese momento.
          </li>
        </ul>
        <p>
          Los planes dependen de la capacidad libre de la granja. Si un pago se confirma cuando ya no hay capacidad, o cuando ese mes ya estaba pagado, te devolvemos el dinero por el mismo medio
          cuando sea posible, en un plazo de <Ph>[número]</Ph> días hábiles.
        </p>
      </>
    ),
  },
  {
    id: "mora",
    title: "Si no pagas un mes",
    body: (
      <ul>
        <li>Si al terminar un mes pagado no has pagado el siguiente, el plan queda en pausa: deja de minar y no se cobra nada.</li>
        <li>
          Tienes {GRACE_DAYS} días para pagar. Al hacerlo, el plan retoma por {DAYS_PER_MONTH} días desde la confirmación del pago.
        </li>
        <li>Pasados los {GRACE_DAYS} días, el plan se cierra y libera su capacidad. Los sats que ya minó se conservan en tu saldo.</li>
        <li>Los meses que no se pagan no se minan ni se cobran.</li>
      </ul>
    ),
  },
  {
    id: "saldo",
    title: "Saldo y retiros en BTC",
    body: (
      <>
        <p>Los sats que minan tus planes se suman a tu saldo. Tu saldo es lo minado menos tus retiros.</p>
        <ul>
          <li>
            Puedes pedir un retiro desde {formatSats(MIN_WITHDRAWAL_SATS)}. La solicitud aparta esos sats de tu saldo y la revisa nuestro equipo, que la envía en un plazo de <Ph>[número]</Ph> días
            hábiles.
          </li>
          <li>
            Enviamos los BTC a la dirección Bitcoin que indicas y te compartimos el txid de la transacción. Revisa la dirección antes de enviarla: un envío a una dirección equivocada no se puede
            reversar. <Ph>[Definir quién asume la comisión de la red en cada envío.]</Ph>
          </li>
          <li>Podemos pedirte información adicional antes de enviar un retiro, o rechazarlo indicando el motivo. En ese caso los sats vuelven a tu saldo.</li>
        </ul>
      </>
    ),
  },
  {
    id: "impuestos",
    title: "Facturación e impuestos",
    body: (
      <p>
        <Ph>[Definir con el contador y el asesor legal: facturación electrónica de los planes, IVA, retención en la fuente, tratamiento tributario de los BTC recibidos y certificados.]</Ph> Cada
        cliente responde por sus propias obligaciones tributarias.
      </p>
    ),
  },
  {
    id: "cierre",
    title: "Cierre de un plan",
    body: (
      <>
        <p>
          Podemos cerrar un plan si el pago que lo activó es reversado o devuelto por el banco o la pasarela, si detectamos fraude o información falsa, o si lo ordena una autoridad. Un plan cerrado
          deja de minar y libera su capacidad.
        </p>
        <p>
          Si la pasarela nos informa que un pago fue devuelto o desconocido, el mes que ese pago activó deja de minar en ese momento. Mientras conciliamos la devolución contigo no podrás retirar ni
          pagar más meses de ese plan.
        </p>
        <p>
          <Ph>
            [El asesor legal debe definir qué pasa con el saldo cuando el pago fue reversado, y la política de retracto y devoluciones de un mes ya pagado, según el Estatuto del Consumidor cuando
            aplique.]
          </Ph>
        </p>
      </>
    ),
  },
  {
    id: "riesgos",
    title: "Riesgos",
    body: (
      <>
        <ul>
          <li>El precio del BTC sube y baja: el valor en pesos de lo minado puede ser menor que lo que pagaste.</li>
          <li>La dificultad de la red y las comisiones cambian, y con ellas el hashprice de los meses siguientes.</li>
          <li>La granja puede tener interrupciones por mantenimiento, fallas o eventos de fuerza mayor.</li>
          <li>La regulación de los criptoactivos y de la minería, y las normas tributarias, pueden cambiar.</li>
        </ul>
        <p>
          <Ph>
            [Confirmar con el asesor legal y dejar expreso: si {LEGAL.company} es o no una entidad vigilada por la Superintendencia Financiera de Colombia, que un plan de hashrate no es un
            depósito ni un producto financiero, y que el esquema cumple las normas sobre captación de dineros del público.]
          </Ph>
        </p>
      </>
    ),
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    body: (
      <p>
        {BRAND.name} responde por la prestación diligente de sus servicios. No responde por fallas de terceros (Mercado Pago, la red Bitcoin y otras redes blockchain, wallets, bancos o proveedores de internet) ni por
        casos de fuerza mayor o caso fortuito. <Ph>[El asesor legal debe ajustar esta cláusula a la ley colombiana.]</Ph>
      </p>
    ),
  },
  {
    id: "renovacion",
    title: "Al terminar un plan",
    body: (
      <ul>
        <li>Un plan no se renueva solo ni se cobra de forma automática. Tu panel te avisa cuando se acerca el vencimiento de cada mes y el final del plan.</li>
        <li>
          Puedes comprar el mismo plan de nuevo con un clic. El plan nuevo se compra con los precios publicados ese día, según la capacidad libre de la granja y con los términos vigentes.
        </li>
        <li>Los sats que minó el plan terminado se conservan en tu saldo.</li>
      </ul>
    ),
  },
  {
    id: "cuenta",
    title: "Tus datos y tu cuenta",
    body: (
      <p>
        Desde tu perfil puedes descargar tus datos y pedir que eliminemos tu cuenta. Para eliminarla no puedes tener planes vigentes, saldo a favor ni pagos, retiros o devoluciones en curso.
        Conservamos lo que exigen las normas contables, tributarias y de prevención de lavado de activos, como explica la{" "}
        <Link href="/privacidad" className="link text-ink">
          Política de Tratamiento de Datos
        </Link>
        .
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    body: (
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión y te pediremos aceptarla antes de tu siguiente compra. Los planes ya comprados conservan las condiciones con que se compraron.
        La versión vigente es la {LEGAL.version}.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable y reclamos",
    body: (
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Puedes enviar peticiones, quejas y reclamos a <Ph>{LEGAL.email}</Ph>. Las controversias se resolverán{" "}
        <Ph>[definir: jueces de la ciudad del domicilio, o centro de conciliación y arbitraje]</Ph>.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      intro={
        <p>
          Estos términos regulan el uso de la plataforma {BRAND.name} y la compra de planes de hashrate para minar Bitcoin. Al registrarte como cliente y comprar un plan, los aceptas. También aplica
          nuestra{" "}
          <Link href="/privacidad" className="link text-ink">
            Política de Tratamiento de Datos
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  );
}
