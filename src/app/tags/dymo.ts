/*
  The DYMO side of מערכת הדפסת תגים - a faithful copy of the Bolt project's
  DymoService.ts (the owner, 27/10: "בצורה מדויקת"). Runs in the browser only:
  it talks to the DYMO Web Service that DYMO Connect installs on the computer
  the LabelWriter is plugged into (https://127.0.0.1:41951), the same way the
  original did, so any https page can print from that computer.

  Two label layouts, both taken verbatim from the project: the React app
  printed on 30334 (2¼ × 1¼ in, portrait: name 16pt bold, office 12pt); the
  standalone HTML in the same zip printed on 30252 address labels (landscape,
  text rotated 270°). The person at the desk picks the roll that is loaded.
*/
import type { DymoPrinter, DymoStatus } from "./types";

export const DYMO_SERVICE_URL = "https://127.0.0.1:41951/DYMO/DLS/Printing";

const LABEL_30334 = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
	<PaperOrientation>Portrait</PaperOrientation>
	<Id>Small30334</Id>
	<IsOutlined>false</IsOutlined>
	<PaperName>30334 2-1/4 in x 1-1/4 in</PaperName>
	<DrawCommands>
		<RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="270" Ry="270" />
	</DrawCommands>
	<ObjectInfo>
		<TextObject>
			<Name>TEXT</Name>
			<ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
			<BackColor Alpha="0" Red="255" Green="255" Blue="255" />
			<LinkedObjectName />
			<Rotation>Rotation0</Rotation>
			<IsMirrored>False</IsMirrored>
			<IsVariable>False</IsVariable>
			<GroupID>-1</GroupID>
			<IsOutlined>False</IsOutlined>
			<HorizontalAlignment>Center</HorizontalAlignment>
			<VerticalAlignment>Top</VerticalAlignment>
			<TextFitMode>ShrinkToFit</TextFitMode>
			<UseFullFontHeight>True</UseFullFontHeight>
			<Verticalized>False</Verticalized>
			<StyledText>
				<Element>
					<String xml:space="preserve">Name</String>
					<Attributes>
						<Font Family="Arial" Size="16" Bold="True" Italic="False" Underline="False" Strikeout="False" />
						<ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
					</Attributes>
				</Element>
			</StyledText>
		</TextObject>
		<Bounds X="66.2876712328772" Y="510.410958904111" Width="3116.71232876712" Height="397.808219178081" />
	</ObjectInfo>
	<ObjectInfo>
		<TextObject>
			<Name>TEXT_1</Name>
			<ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
			<BackColor Alpha="0" Red="255" Green="255" Blue="255" />
			<LinkedObjectName />
			<Rotation>Rotation0</Rotation>
			<IsMirrored>False</IsMirrored>
			<IsVariable>False</IsVariable>
			<GroupID>-1</GroupID>
			<IsOutlined>False</IsOutlined>
			<HorizontalAlignment>Center</HorizontalAlignment>
			<VerticalAlignment>Top</VerticalAlignment>
			<TextFitMode>ShrinkToFit</TextFitMode>
			<UseFullFontHeight>True</UseFullFontHeight>
			<Verticalized>False</Verticalized>
			<StyledText>
				<Element>
					<String xml:space="preserve">office</String>
					<Attributes>
						<Font Family="Arial" Size="12" Bold="False" Italic="False" Underline="False" Strikeout="False" />
						<ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
					</Attributes>
				</Element>
			</StyledText>
		</TextObject>
		<Bounds X="191.219178082193" Y="983.835616438359" Width="2880" Height="325.479452054794" />
	</ObjectInfo>
</DieCutLabel>`;

const LABEL_30252 = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
  <DrawCommands/>
  <ObjectInfo>
    <TextObject>
      <Name>Name</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation270</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>__NAME__</String>
          <Attributes>
            <Font Family="Arial" Size="14" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="1500" Y="200" Width="1800" Height="2000"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Office</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation270</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>__OFFICE__</String>
          <Attributes>
            <Font Family="Arial" Size="10" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="400" Y="200" Width="900" Height="2000"/>
  </ObjectInfo>
</DieCutLabel>`;

export type LabelKey = "30334" | "30252";

export const LABELS: Record<LabelKey, { label: string; xml: string }> = {
  "30334": { label: "30334 רב-שימושית (2¼ × 1¼ אינץ׳)", xml: LABEL_30334 },
  "30252": { label: "30252 כתובת (מסובב)", xml: LABEL_30252 },
};

const LABEL_PREF = "hc-tags-label";

export function loadLabelKey(): LabelKey {
  try {
    const v = window.localStorage.getItem(LABEL_PREF);
    return v === "30252" ? "30252" : "30334";
  } catch {
    return "30334";
  }
}

export function saveLabelKey(key: LabelKey): void {
  try {
    window.localStorage.setItem(LABEL_PREF, key);
  } catch {
    /* a private window keeps the default */
  }
}

const PRINTER_PREF = "hc-tags-printer";
/** DYMO answers in well under a second; a hanging call means the spooler is stuck - say so instead of ״מדפיסה...״ forever. */
const REQUEST_TIMEOUT = 20_000;

export function loadPrinterPref(): string | null {
  try {
    return window.localStorage.getItem(PRINTER_PREF);
  } catch {
    return null;
  }
}

export function savePrinterPref(name: string): void {
  try {
    window.localStorage.setItem(PRINTER_PREF, name);
  } catch {
    /* a private window keeps the default */
  }
}

function dymoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${DYMO_SERVICE_URL}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
}

/**
 * Every printer DYMO knows, from GetPrinters' XML: the Windows name, the model
 * and whether DYMO sees it plugged in right now. The original took the first
 * <Name> blindly - on a computer with an old, unplugged DYMO entry that sends
 * the labels into a queue nothing ever prints.
 */
export function parsePrinters(xml: string): DymoPrinter[] {
  const out: DymoPrinter[] = [];
  const re = /<(LabelWriterPrinter|LabelManagerPrinter)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[2];
    const tag = (name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ?? "";
    const name = tag("Name");
    if (!name) continue;
    out.push({ name, model: tag("ModelName") || name, connected: /^true$/i.test(tag("IsConnected")), labelWriter: m[1] === "LabelWriterPrinter" });
  }
  return out;
}

/** The printer to use: the one she picked if DYMO still lists it, else a connected LabelWriter, else any LabelWriter. */
export function pickPrinter(printers: DymoPrinter[], preferred?: string | null): DymoPrinter | null {
  const writers = printers.filter((p) => p.labelWriter);
  if (preferred) {
    const p = writers.find((x) => x.name === preferred);
    if (p) return p;
  }
  return writers.find((p) => p.connected) ?? writers[0] ?? null;
}

/** "Checking DYMO Web Service" - is it running, which printers it sees, which one we will print on. */
export async function initDymo(preferred?: string | null): Promise<DymoStatus> {
  try {
    const response = await dymoFetch("/Check");
    if (!response.ok) return { isReady: false, message: "DYMO Web Service לא זמין", printers: [] };

    const printersResponse = await dymoFetch("/GetPrinters");
    if (!printersResponse.ok) return { isReady: false, message: "לא ניתן לקבל רשימת מדפסות", printers: [] };

    const printers = parsePrinters(await printersResponse.text());
    const chosen = pickPrinter(printers, preferred);
    if (!chosen) return { isReady: false, message: "לא נמצאה מדפסת DYMO LabelWriter", printers };
    if (!chosen.connected) return { isReady: false, message: `${chosen.name} - לא מחוברת לפי DYMO`, printers, printer: chosen.name };
    return { isReady: true, message: `DYMO מוכן - ${chosen.name}`, printers, printer: chosen.name };
  } catch (error) {
    console.error("Error checking DYMO status:", error);
    return { isReady: false, message: "שגיאה בבדיקת מצב DYMO", printers: [] };
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** The label XML with the two texts in place. */
export function labelXmlFor(key: LabelKey, tagName: string, officeLine: string): string {
  const name = escapeXml(tagName);
  const office = escapeXml(officeLine);
  if (key === "30252") return LABEL_30252.replace("__NAME__", name).replace("__OFFICE__", office);
  return LABEL_30334.replace('<String xml:space="preserve">Name</String>', `<String xml:space="preserve">${name}</String>`).replace(
    '<String xml:space="preserve">office</String>',
    `<String xml:space="preserve">${office}</String>`
  );
}

/** Sends one label to the printer - the same form-encoded PrintLabel call the original made. Throws a Hebrew message. */
export async function printLabel(tagName: string, officeLine: string, printerName: string, key: LabelKey): Promise<void> {
  const labelXml = labelXmlFor(key, tagName, officeLine);
  const body = "printerName=" + encodeURIComponent(printerName) + "&printParamsXml=" + "&labelXml=" + encodeURIComponent(labelXml) + "&labelSetXml=";
  let response: Response;
  try {
    response = await dymoFetch("/PrintLabel", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new Error(timedOut ? "DYMO לא ענה תוך 20 שניות - בדקי את תור ההדפסה של המדפסת ב-Windows (עבודות תקועות, Offline או Paused)" : "לא הצלחתי לדבר עם DYMO Web Service");
  }
  const answer = (await response.text().catch(() => "")).trim();
  if (!response.ok) {
    console.error("Print error response:", answer);
    throw new Error(`DYMO סירב להדפיס${answer ? `: ${answer.slice(0, 200)}` : ""}`);
  }
  if (/^false$/i.test(answer)) throw new Error("DYMO ענה false - המדבקה לא נשלחה למדפסת");
}
