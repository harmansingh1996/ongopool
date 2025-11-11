import { supabase } from './supabase';

export interface RatingStatsResult {
  success: boolean;
  averageRating?: number;
  ratingsCount?: number;
  error?: string;
}

/**
 * Recalculate and persist rating stats for a user after a review change.
 */
export async function refreshUserRatingStats(ratedUserId: string): Promise<RatingStatsResult> {
  try {
    const { data: ratingsData, error: ratingsError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('rated_user_id', ratedUserId);

    if (ratingsError) {
      console.error('Failed to load ratings while refreshing stats:', ratingsError);
      return {
        success: false,
        error: ratingsError.message ?? 'Unable to load ratings for stats update',
      };
    }

    const totalRatings = ratingsData?.length ?? 0;
    const averageRating = totalRatings > 0
      ? ratingsData!.reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / totalRatings
      : 0;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        rating: averageRating,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ratedUserId);

    if (updateError) {
      console.error('Failed to update user rating stats:', updateError);
      return {
        success: false,
        error: updateError.message ?? 'Unable to update user rating stats',
      };
    }

    return {
      success: true,
      averageRating,
      ratingsCount: totalRatings,
    };
  } catch (error) {
    console.error('Unexpected error refreshing rating stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error refreshing rating stats',
    };
  }
}
