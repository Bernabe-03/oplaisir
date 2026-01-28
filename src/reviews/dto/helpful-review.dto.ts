import { IsBoolean } from 'class-validator';

export class HelpfulReviewDto {
  @IsBoolean()
  isHelpful: boolean;
}