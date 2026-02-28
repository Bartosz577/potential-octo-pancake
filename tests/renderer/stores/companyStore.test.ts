import { describe, it, expect, beforeEach } from 'vitest'
import { useCompanyStore } from '../../../src/renderer/src/stores/companyStore'
import type { CompanyData } from '../../../src/renderer/src/stores/companyStore'

const emptyCompany: CompanyData = {
  nip: '',
  fullName: '',
  regon: '',
  kodUrzedu: '',
  email: '',
  phone: ''
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

describe('companyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useCompanyStore.setState({
      company: { ...emptyCompany },
      period: { year: currentYear, month: currentMonth, celZlozenia: 1 },
      savedCompanies: []
    })
  })

  describe('setCompany', () => {
    it('partially updates company data', () => {
      useCompanyStore.getState().setCompany({ nip: '1234567890', fullName: 'Test Sp. z o.o.' })

      const { company } = useCompanyStore.getState()
      expect(company.nip).toBe('1234567890')
      expect(company.fullName).toBe('Test Sp. z o.o.')
      // Other fields remain default
      expect(company.regon).toBe('')
      expect(company.kodUrzedu).toBe('')
    })

    it('merges with existing data', () => {
      useCompanyStore.getState().setCompany({ nip: '1234567890' })
      useCompanyStore.getState().setCompany({ fullName: 'Updated Name' })

      const { company } = useCompanyStore.getState()
      expect(company.nip).toBe('1234567890')
      expect(company.fullName).toBe('Updated Name')
    })
  })

  describe('setPeriod', () => {
    it('partially updates period data', () => {
      useCompanyStore.getState().setPeriod({ year: 2025 })

      const { period } = useCompanyStore.getState()
      expect(period.year).toBe(2025)
      expect(period.month).toBe(currentMonth) // unchanged
      expect(period.celZlozenia).toBe(1) // unchanged
    })

    it('can update multiple period fields', () => {
      useCompanyStore.getState().setPeriod({ month: 6, celZlozenia: 2 })

      const { period } = useCompanyStore.getState()
      expect(period.month).toBe(6)
      expect(period.celZlozenia).toBe(2)
    })
  })

  describe('saveCompany', () => {
    it('saves current company to savedCompanies array', () => {
      useCompanyStore.getState().setCompany({
        nip: '5261040828',
        fullName: 'Test Corp'
      })
      useCompanyStore.getState().saveCompany()

      const { savedCompanies } = useCompanyStore.getState()
      expect(savedCompanies).toHaveLength(1)
      expect(savedCompanies[0].nip).toBe('5261040828')
      expect(savedCompanies[0].fullName).toBe('Test Corp')
    })

    it('updates existing company if NIP matches', () => {
      useCompanyStore.getState().setCompany({
        nip: '5261040828',
        fullName: 'Old Name'
      })
      useCompanyStore.getState().saveCompany()

      useCompanyStore.getState().setCompany({
        nip: '5261040828',
        fullName: 'New Name'
      })
      useCompanyStore.getState().saveCompany()

      const { savedCompanies } = useCompanyStore.getState()
      expect(savedCompanies).toHaveLength(1)
      expect(savedCompanies[0].fullName).toBe('New Name')
    })

    it('does nothing if NIP is empty', () => {
      useCompanyStore.getState().setCompany({ nip: '', fullName: 'No NIP' })
      useCompanyStore.getState().saveCompany()

      expect(useCompanyStore.getState().savedCompanies).toHaveLength(0)
    })

    it('saves multiple companies with different NIPs', () => {
      useCompanyStore.getState().setCompany({ nip: '1111111111', fullName: 'Company A' })
      useCompanyStore.getState().saveCompany()

      useCompanyStore.getState().setCompany({ nip: '2222222222', fullName: 'Company B' })
      useCompanyStore.getState().saveCompany()

      expect(useCompanyStore.getState().savedCompanies).toHaveLength(2)
    })
  })

  describe('loadCompany', () => {
    it('loads company by NIP from savedCompanies', () => {
      // Save a company first
      useCompanyStore.getState().setCompany({
        nip: '5261040828',
        fullName: 'Saved Corp',
        regon: '012345678',
        kodUrzedu: '1471',
        email: 'test@test.pl',
        phone: '123456789'
      })
      useCompanyStore.getState().saveCompany()

      // Clear current company
      useCompanyStore.getState().setCompany({ ...emptyCompany })
      expect(useCompanyStore.getState().company.fullName).toBe('')

      // Load saved company
      useCompanyStore.getState().loadCompany('5261040828')

      const { company } = useCompanyStore.getState()
      expect(company.nip).toBe('5261040828')
      expect(company.fullName).toBe('Saved Corp')
      expect(company.regon).toBe('012345678')
    })

    it('does nothing if NIP not found in saved companies', () => {
      useCompanyStore.getState().setCompany({ nip: '9999999999', fullName: 'Current' })

      useCompanyStore.getState().loadCompany('0000000000')

      // Company should remain unchanged
      expect(useCompanyStore.getState().company.fullName).toBe('Current')
    })
  })

  describe('removeSavedCompany', () => {
    it('removes company by NIP', () => {
      useCompanyStore.getState().setCompany({ nip: '1111111111', fullName: 'A' })
      useCompanyStore.getState().saveCompany()
      useCompanyStore.getState().setCompany({ nip: '2222222222', fullName: 'B' })
      useCompanyStore.getState().saveCompany()

      useCompanyStore.getState().removeSavedCompany('1111111111')

      const { savedCompanies } = useCompanyStore.getState()
      expect(savedCompanies).toHaveLength(1)
      expect(savedCompanies[0].nip).toBe('2222222222')
    })

    it('does nothing if NIP not found', () => {
      useCompanyStore.getState().setCompany({ nip: '1111111111', fullName: 'A' })
      useCompanyStore.getState().saveCompany()

      useCompanyStore.getState().removeSavedCompany('9999999999')

      expect(useCompanyStore.getState().savedCompanies).toHaveLength(1)
    })
  })
})
