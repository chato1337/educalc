import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

import { brandGradients, brandSlideGradient } from '@/app/theme'

export type LoginFeatureSlide = {
  id: string
  titleKey: string
  quoteKey: string
  descriptionKey: string
  icon: SvgIconComponent
  gradient: string
}

export const LOGIN_FEATURE_SLIDES: LoginFeatureSlide[] = [
  {
    id: 'academicStructure',
    titleKey: 'login.slides.academicStructure.title',
    quoteKey: 'login.slides.academicStructure.quote',
    descriptionKey: 'login.slides.academicStructure.description',
    icon: SchoolOutlinedIcon,
    gradient: brandSlideGradient(brandGradients.blue),
  },
  {
    id: 'students',
    titleKey: 'login.slides.students.title',
    quoteKey: 'login.slides.students.quote',
    descriptionKey: 'login.slides.students.description',
    icon: GroupsOutlinedIcon,
    gradient: brandSlideGradient(brandGradients.steel),
  },
  {
    id: 'bulkLoad',
    titleKey: 'login.slides.bulkLoad.title',
    quoteKey: 'login.slides.bulkLoad.quote',
    descriptionKey: 'login.slides.bulkLoad.description',
    icon: UploadFileOutlinedIcon,
    gradient: brandSlideGradient(brandGradients.navy),
  },
  {
    id: 'performance',
    titleKey: 'login.slides.performance.title',
    quoteKey: 'login.slides.performance.quote',
    descriptionKey: 'login.slides.performance.description',
    icon: AssessmentOutlinedIcon,
    gradient: brandSlideGradient(brandGradients.deep),
  },
]
