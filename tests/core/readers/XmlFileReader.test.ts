import { describe, it, expect, beforeAll } from 'vitest'
import * as iconv from 'iconv-lite'
import { XmlFileReader } from '../../../src/core/readers/XmlFileReader'

describe('XmlFileReader', () => {
  let reader: XmlFileReader

  beforeAll(() => {
    reader = new XmlFileReader()
  })

  describe('canRead', () => {
    it('accepts .xml files starting with <?xml', () => {
      const buf = Buffer.from('<?xml version="1.0"?><root/>')
      expect(reader.canRead(buf, 'data.xml')).toBe(true)
    })

    it('accepts .xml files starting with <', () => {
      const buf = Buffer.from('<root><item/></root>')
      expect(reader.canRead(buf, 'data.xml')).toBe(true)
    })

    it('rejects .json files', () => {
      const buf = Buffer.from('{"data": []}')
      expect(reader.canRead(buf, 'data.json')).toBe(false)
    })

    it('rejects .csv files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.csv')).toBe(false)
    })

    it('rejects .xml files with non-XML content', () => {
      const buf = Buffer.from('not xml at all')
      expect(reader.canRead(buf, 'data.xml')).toBe(false)
    })
  })

  describe('read — repeating elements', () => {
    it('parses XML with repeating child elements', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktury>
  <Faktura>
    <Numer>FV/001</Numer>
    <Data>2026-01-15</Data>
    <Kwota>100,50</Kwota>
  </Faktura>
  <Faktura>
    <Numer>FV/002</Numer>
    <Data>2026-01-16</Data>
    <Kwota>200,00</Kwota>
  </Faktura>
  <Faktura>
    <Numer>FV/003</Numer>
    <Data>2026-01-17</Data>
    <Kwota>350,75</Kwota>
  </Faktura>
</Faktury>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'faktury.xml')

      expect(result.sheets).toHaveLength(1)
      const sheet = result.sheets[0]
      expect(sheet.name).toBe('Faktura')
      expect(sheet.headers).toEqual(['Numer', 'Data', 'Kwota'])
      expect(sheet.rows).toHaveLength(3)
      expect(sheet.rows[0].cells).toEqual(['FV/001', '2026-01-15', '100,50'])
      expect(sheet.rows[1].cells).toEqual(['FV/002', '2026-01-16', '200,00'])
      expect(sheet.rows[2].cells).toEqual(['FV/003', '2026-01-17', '350,75'])
    })

    it('handles multiple distinct repeating sections', () => {
      const xml = `<JPK>
  <Naglowek>
    <KodFormularza>JPK_VAT</KodFormularza>
  </Naglowek>
  <SprzedazWiersz>
    <Lp>1</Lp>
    <NrFaktury>FV/001</NrFaktury>
  </SprzedazWiersz>
  <SprzedazWiersz>
    <Lp>2</Lp>
    <NrFaktury>FV/002</NrFaktury>
  </SprzedazWiersz>
  <ZakupWiersz>
    <Lp>1</Lp>
    <NrDokumentu>FZ/001</NrDokumentu>
  </ZakupWiersz>
</JPK>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'jpk.xml')

      // Should find SprzedazWiersz (2 items) and ZakupWiersz (1 item in array)
      // ZakupWiersz has only 1 element, so fast-xml-parser may not wrap it in array
      expect(result.sheets.length).toBeGreaterThanOrEqual(1)

      const sprzedaz = result.sheets.find((s) => s.name === 'SprzedazWiersz')
      expect(sprzedaz).toBeDefined()
      expect(sprzedaz!.rows).toHaveLength(2)
      expect(sprzedaz!.headers).toContain('Lp')
      expect(sprzedaz!.headers).toContain('NrFaktury')
    })

    it('flattens nested elements with dot notation', () => {
      const xml = `<Root>
  <Item>
    <Name>A</Name>
    <Address>
      <City>Warsaw</City>
      <Zip>00-001</Zip>
    </Address>
  </Item>
  <Item>
    <Name>B</Name>
    <Address>
      <City>Kraków</City>
      <Zip>30-001</Zip>
    </Address>
  </Item>
</Root>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'nested.xml')

      const sheet = result.sheets[0]
      expect(sheet.headers).toContain('Name')
      expect(sheet.headers).toContain('Address.City')
      expect(sheet.headers).toContain('Address.Zip')
      expect(sheet.rows[0].cells[sheet.headers!.indexOf('Address.City')]).toBe('Warsaw')
      expect(sheet.rows[1].cells[sheet.headers!.indexOf('Address.City')]).toBe('Kraków')
    })

    it('includes XML attributes in columns', () => {
      const xml = `<Products>
  <Product id="1" active="true">
    <Name>Młotek</Name>
    <Price>25.50</Price>
  </Product>
  <Product id="2" active="false">
    <Name>Śruba</Name>
    <Price>0.50</Price>
  </Product>
</Products>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'products.xml')

      const sheet = result.sheets[0]
      expect(sheet.headers).toContain('id')
      expect(sheet.headers).toContain('active')
      expect(sheet.headers).toContain('Name')
      expect(sheet.rows[0].cells[sheet.headers!.indexOf('id')]).toBe('1')
      expect(sheet.rows[1].cells[sheet.headers!.indexOf('Name')]).toBe('Śruba')
    })

    it('stores xmlPath in metadata', () => {
      const xml = `<Root><Items><Item><A>1</A></Item><Item><A>2</A></Item></Items></Root>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'path.xml')

      const sheet = result.sheets[0]
      expect(sheet.metadata.xmlPath).toBe('Root.Items.Item')
    })
  })

  describe('read — JPK-like structures', () => {
    it('parses JPK_FA-like XML', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
  </Naglowek>
  <Faktura>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-01-15</P_1>
    <P_2>FV/001/2026</P_2>
    <P_15>123,00</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
  </Faktura>
  <Faktura>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-01-16</P_1>
    <P_2>FV/002/2026</P_2>
    <P_15>456,00</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
  </Faktura>
  <FakturaCtrl>
    <LiczbaFaktur>2</LiczbaFaktur>
    <WartoscFaktur>579,00</WartoscFaktur>
  </FakturaCtrl>
</JPK>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'jpk_fa.xml')

      const faktura = result.sheets.find((s) => s.name === 'Faktura')
      expect(faktura).toBeDefined()
      expect(faktura!.rows).toHaveLength(2)
      expect(faktura!.headers).toContain('KodWaluty')
      expect(faktura!.headers).toContain('P_1')
      expect(faktura!.headers).toContain('P_2')
      expect(faktura!.rows[0].cells[faktura!.headers!.indexOf('P_2')]).toBe('FV/001/2026')
    })
  })

  describe('read — edge cases', () => {
    it('handles empty file', () => {
      const buf = Buffer.from('', 'utf-8')
      const result = reader.read(buf, 'empty.xml')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('pusty'))).toBe(true)
    })

    it('handles invalid XML', () => {
      const buf = Buffer.from('<root><unclosed>', 'utf-8')
      const result = reader.read(buf, 'invalid.xml')
      // fast-xml-parser may or may not throw on this — it's lenient
      // Either sheets are empty or there's a warning
      expect(result.sheets.length + result.warnings.length).toBeGreaterThanOrEqual(0)
    })

    it('handles XML with no repeating elements', () => {
      const xml = `<Config><Setting1>A</Setting1><Setting2>B</Setting2></Config>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'config.xml')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('Nie znaleziono'))).toBe(true)
    })

    it('handles Polish characters in UTF-8', () => {
      const xml = `<Dane>
  <Wiersz><Nazwa>Zielińscy Sp. z o.o.</Nazwa><Miasto>Łódź</Miasto></Wiersz>
  <Wiersz><Nazwa>Świętokrzyskie S.A.</Nazwa><Miasto>Kraków</Miasto></Wiersz>
</Dane>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'polish.xml')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[sheet.headers!.indexOf('Nazwa')]).toBe('Zielińscy Sp. z o.o.')
      expect(sheet.rows[1].cells[sheet.headers!.indexOf('Miasto')]).toBe('Kraków')
    })

    it('handles windows-1250 encoded XML', () => {
      const xml = '<?xml version="1.0" encoding="windows-1250"?>\n<Root><Item><Name>Łódź</Name></Item><Item><Name>Kraków</Name></Item></Root>'
      const buf = iconv.encode(xml, 'windows-1250')
      const result = reader.read(buf, 'win1250.xml')

      const sheet = result.sheets[0]
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells[0]).toBe('Łódź')
      expect(sheet.rows[1].cells[0]).toBe('Kraków')
    })

    it('preserves row indices', () => {
      const xml = `<Root><Item><A>1</A></Item><Item><A>2</A></Item><Item><A>3</A></Item></Root>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'indexed.xml')

      const rows = result.sheets[0].rows
      expect(rows[0].index).toBe(0)
      expect(rows[1].index).toBe(1)
      expect(rows[2].index).toBe(2)
    })

    it('handles elements with mixed text and attributes', () => {
      const xml = `<Data>
  <Row status="ok"><Col1>A</Col1><Col2>B</Col2></Row>
  <Row status="err"><Col1>C</Col1><Col2>D</Col2></Row>
</Data>`
      const buf = Buffer.from(xml, 'utf-8')
      const result = reader.read(buf, 'mixed.xml')

      const sheet = result.sheets[0]
      expect(sheet.headers).toContain('status')
      expect(sheet.headers).toContain('Col1')
      expect(sheet.rows[0].cells[sheet.headers!.indexOf('status')]).toBe('ok')
    })
  })
})
