import { useTranslation } from 'react-i18next'

import { AcademicIndicatorCatalogsPage } from './AcademicIndicatorCatalogsPage'

/**
 * Ruta `/academic-indicators`: CRUD del catálogo (`/api/academic-indicator-catalogs/`),
 * misma pantalla que `/academic-indicator-catalogs` con titular de navegación distinto.
 */
export function AcademicIndicatorsPage() {
  const { t } = useTranslation()
  return (
    <AcademicIndicatorCatalogsPage
      pageTitle={t('academicIndicatorsOps.title')}
      pageSubtitle={t('academicIndicatorsOps.subtitle')}
      selectInstitutionMessage={t('academicIndicatorsOps.selectInstitution')}
    />
  )
}
