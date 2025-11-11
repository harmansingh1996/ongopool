# OnGoPool - Complete Carpool Application

## Project Overview

OnGoPool is a modern, full-stack carpool application built with React, TypeScript, and Supabase. The app enables users to find and share rides with real-time chat, payment processing, intelligent route mapping, comprehensive trip management, and user profiles.

## Project Status

- **Project Type**: React + TypeScript Modern Web Application (Complete Carpool Platform)
- **Database**: Supabase (Live database connected)
- **Entry Point**: `src/main.tsx` (React application entry)
- **Build System**: Vite 7.0.0 (Fast development and build)
- **Styling System**: Tailwind CSS 3.4.17 (Atomic CSS framework)

### Recent Update — 2025-11-11
- Frontend payout helpers now send authenticated requests to the deployed Render backend for listing, saving, updating, and removing payout methods; they derive the API base from `VITE_BACKEND_API_URL` (fallback `/api/stripe`).
- Payout request modal now surfaces loading states, success toasts, and actionable errors when managing payout methods, and its default selection refreshes automatically after each change.
- To keep builds passing, ensure commands run from the workspace root; the previous attempt inside `packages/web` failed because that package doesn’t exist in this repo.

## Complete Features Implemented

### 1. Authentication System ✅
- User registration and login with Supabase Auth
- Automatic user profile creation
- Protected routes and session management

### 2. Core Ride Management ✅
- **Find Rides**: Advanced search with real-time Supabase data
- **Ride Details**: Comprehensive booking system with payment integration
- **Post Rides**: Create rides with optional stops and route optimization
- **Real-time Data**: All features connect to live database

### 3. Real-Time Chat System ✅
- **Driver-Passenger Communication**: Full messaging between ride participants
- **Ride Request Management**: Automatic chat creation on booking
- **Status Updates**: Real-time ride request status (pending, confirmed, cancelled)
- **Action Buttons**: Driver accept/decline, passenger cancel functionality
- **Supabase Real-time**: Live message updates and notifications

### 4. Dual Payment Integration ✅ - STRIPE & PAYPAL
- **Unified Payment Modal**: Professional interface supporting both payment methods
- **Multiple Payment Options**: 
  - **Stripe**: Credit/debit card processing with secure card validation
  - **PayPal**: Alternative payment method with PayPal account integration
- **Payment Method Selection**: Users can choose between card payment or PayPal during checkout
- **Payment Holds System**: Both payment processors support authorization holds for ride requests
- **Secure Processing**: Encrypted transactions and PCI-compliant handling
- **Payment Status Tracking**: Real-time integration with booking status
- **Canadian Currency**: All payments processed in CAD for both Stripe and PayPal
- **Saved Payment Methods**: Users can save both card and PayPal payment methods for future use

### 5. Enhanced Intelligent Route Mapping ✅ - RECENTLY FIXED
- **Address Autocomplete**: OpenStreetMap-powered address suggestions
- **Multi-Service Routing**: Enhanced reliability with OSRM + GraphHopper backup routing services
- **Distance Calculation**: Multiple free routing APIs with enhanced Haversine formula fallback
- **FIXED ETA Estimation**: Intelligent time calculations with mandatory departure time validation (prevents 16+ hour ETA bugs)
- **ENHANCED Realistic ETA Validation**: Advanced validation system to detect and reject unrealistic routing API results
- **IMPROVED Enhanced Fallback System**: City-to-city route estimates for Ontario with realistic travel times and better coordinate validation
- **Speed Validation**: Automatic detection of impossible speeds (outside 5-150 km/h range)
- **FIXED Coordinate Validation**: Pre-validation of GPS coordinates before API calls (prevents routing failures)
- **Price Calculation**: Distance-based fare estimation with segment pricing
- **Coordinate Storage**: GPS coordinates saved for route optimization with validation
- **Improved Reliability**: Automatic failover between routing services for better uptime
- **Route Duration Examples**: 
  - Kitchener to Woodstock: ~50 minutes
  - Woodstock to London: ~45 minutes  
  - London to Windsor: ~3 hours highway driving
  - Hamilton to Toronto: ~75 minutes
  - Cambridge to Kitchener: ~20 minutes

### 6. Enhanced Trip Management System with Live ETA ✅ - RECENTLY FIXED
- **Driver Dashboard**: Complete ride management for drivers
- **Three-Section Layout**: Active, Upcoming, and Completed rides
- **Date-Grouped Itinerary**: TripPage groups rides by departure date with headers; ride cards show horizontal origin→destination layout for better space usage
- **One-Tap Time Editor**: Clicking a ride opens a lightweight time-only editor that validates future times and calls `check_ride_conflicts` before saving
- **Live ETA Ride Details Modal**: Advanced modal with real-time ETA calculations and live tracking
- **FIXED Real-Time ETA Updates**: Live route tracking with 30-second refresh intervals for active trips (was 15s)
- **FIXED Multi-Service ETA Calculation**: Uses enhanced routing system (OSRM + GraphHopper) with mandatory departure time validation
- **FIXED Complete Route Display**: Shows ALL intermediate stops with proper ETAs, matching RideDetailsPage functionality
- **ENHANCED Visual Route Display**: Interactive route visualization with live status indicators for all stops
- **IMPROVED Smart Auto-Refresh Logic**: Live updates only active 2h before to 4h after departure (prevents unnecessary API calls)
- **ENHANCED Coordinate Validation**: Validates GPS coordinates before routing API calls to prevent calculation failures
- **FIXED Base Time Calculation**: Critical bug fix - ETAs now always calculated from departure time, never current time
- **FIXED Missing Stops Issue**: Modal now displays complete route with all segments instead of just origin/destination
- **Action Buttons**: Context-sensitive actions based on ride status
  - **Upcoming**: Edit Trip and Cancel Trip buttons
  - **Active**: Mark Complete and Cancel Trip buttons
  - **Completed**: No action buttons (view only)
- **Passenger Booking Overview**: See all passengers, seats, and booking status
- **Real-time Status Updates**: Live ride status management with accurate ETA tracking

### 7. User Profile Management ✅
- **Complete Profile Section**: User information with edit capability
- **License Verification**: Driver license upload and verification system
- **Earnings & Payouts**: Driver earnings dashboard with payout requests
- **Payment Methods**: Credit card management and payment options
- **Settings**: Notification and privacy settings
- **Logout Functionality**: Secure user logout

### 8. Modern UI/UX ✅
- **Mobile-First Design**: Responsive across all devices
- **Bottom Navigation**: Intuitive app-style navigation
- **Real-time Notifications**: Chat badges and status indicators
- **Gradient Design**: Modern visual aesthetics
- **Interactive Elements**: Clickable ride cards and smooth transitions

## Database Architecture

### Core Tables
- `users` - User profiles with driver information and earnings
- `rides` - Ride offers with GPS coordinates and status management
- `ride_bookings` - Booking requests with payment and status tracking
- `earnings` - **NEW**: Dedicated driver earnings tracking with automatic triggers
- `payout_requests` - **NEW**: Driver payout request management system
- `ride_segments` - Multi-stop route management
- `segment_seats` - Seat allocation per route segment
- `conversations` - Driver-passenger chat threads
- `messages` - Real-time messaging system
- `ratings` - User rating and review system
- `payments` - Payment transaction records
- `price_tiers` - Dynamic pricing configuration
- `driver_license_verifications` - Pending driver license submissions awaiting review

### Real-time Features
- **Live Chat**: Supabase real-time subscriptions for messaging
- **Booking Updates**: Real-time status changes
- **Trip Management**: Live ride status updates
- **Notification System**: Live updates for ride requests
- **Recent Activities Feed**: Trigger-driven log writes for rides posted, ride requests, and booking confirmations

## Technology Stack

### Core Framework
- **React 18.3.1** with TypeScript 5.8.3
- **Vite 7.0.0** for fast development and building
- **Tailwind CSS 3.4.17** for styling

### Backend & Database
- **Supabase**: Authentication, database, and real-time features
- **Live Connection**: `jepvxmejoggfjksqtrgh.supabase.co`
- **Real-time Subscriptions**: Chat and booking updates

### Payment Processing ✅ - LIVE DUAL PAYMENT SYSTEM
OnGoPool supports **live payment processing** with two payment methods:

#### Stripe Integration - LIVE PAYMENTS
- **Primary payment processor** for credit/debit card transactions
- **LIVE Configuration** (Replace with production keys via environment variables):
  - **Publishable Key**: set `VITE_STRIPE_PUBLISHABLE_KEY`
  - **Secret Key**: set `STRIPE_SECRET_KEY` (never check secrets into the repo)
- **Backend API Required**: All Stripe operations require deployed backend API
- **Features**: Live payment holds, real-time capture, secure card processing
- **Currency**: Canadian Dollars (CAD) configured
- **Dashboard Integration**: Payments appear in Stripe dashboard immediately

#### PayPal Integration - LIVE PAYMENTS READY
- **Alternative payment method** for users preferring PayPal
- **Environment-Based Configuration**: Automatically switches between sandbox and production
- **LIVE Configuration** (Replace with production keys):
  - **Client ID**: `AbGPQ42SxKv2Ee4epIpzj9ExeDl89H0AATL6i1cs1SNrZ6-6DFjJK6kJwykQxuNiYk1Ih5s-fFNV3Ha1`
  - **Secret**: `ENAmHMMr6_7sg7CCXrDFX343ExwXWUCfmMqQU88miymiid0OlkD_IlLFylCtLEvSBu7yZzH4wX9f0tVg`
  - **Environment Control**: `VITE_PAYPAL_SANDBOX_MODE=false` for live payments
- **Features**: Live authorization holds, real payment capture, production processing
- **Currency**: Canadian Dollars (CAD) configured
- **Integration**: Full PayPal SDK with automatic environment detection
- **Live Payment Indicators**: Console logging shows sandbox vs production mode

### External Services
- **OpenStreetMap Nominatim**: Address geocoding and search
- **Enhanced Routing System**: Multi-service approach for improved reliability
  - **OSRM Routing**: Primary routing service for distance and duration calculations
  - **GraphHopper**: Backup routing service with automatic failover
  - **Haversine Formula**: Final fallback for offline calculations
- **Leaflet**: Map visualization components (installed)

### State Management & UI
- **Zustand 4.4.7**: Lightweight global state management
- **React Router DOM 6.30.1**: Client-side routing
- **React Hook Form**: Form validation and handling
- **Lucide React**: Modern icon library

## Development Commands

- **Install dependencies**: `npm install --legacy-peer-deps`
- **Build project**: `npm run build`
- **Preview build output locally**: `npm run build && npx serve dist`
- **Run lint (if enabled)**: `npm run lint` (check package.json; add script if missing)

## Key Implementation Details

### LIVE Payment System Architecture ✅ - STRIPE & PAYPAL
```typescript
// CRITICAL: OnGoPool supports live payment processing with both Stripe and PayPal

// Payment Method Selection in PaymentModal
interface PaymentMethod {
  type: 'stripe' | 'paypal';
  processorData?: any; // Stripe card data or PayPal payment details
}

// Unified Payment Processing Service
export class PaymentHoldService {
  static async createPaymentHold(bookingId: number, userId: string, amount: number, paymentMethod: PaymentMethod) {
    if (paymentMethod.type === 'stripe') {
      return await StripeService.createPaymentHold(bookingId, userId, amount, paymentMethod.processorData);
    } else if (paymentMethod.type === 'paypal') {
      return await PayPalService.createPaymentHold(amount, 'CAD', bookingId, userId);
    }
  }
}

// PaymentModal Integration
const PaymentModal = ({ usePaymentHold, bookingId, userId }) => {
  const [selectedPaymentType, setSelectedPaymentType] = useState<'stripe' | 'paypal'>('stripe');
  
  // User can toggle between Stripe card payment and PayPal
  const handlePaymentMethodSwitch = (type: 'stripe' | 'paypal') => {
    setSelectedPaymentType(type);
  };
  
  // Render appropriate payment component based on selection
  return (
    <div>
      {selectedPaymentType === 'stripe' && <StripePaymentForm />}
      {selectedPaymentType === 'paypal' && <PayPalButton intent={usePaymentHold ? 'authorize' : 'capture'} />}
    </div>
  );
};
```

### Currency Configuration (CAD) ✅ - RECENTLY IMPLEMENTED
```typescript
// CRITICAL: All currency operations now use Canadian Dollar (CAD)

// NEW: Currency utility functions at src/utils/currency.ts
export const formatCurrency = (amount: number, options?: {
  currency?: string;
  showSymbol?: boolean;
  precision?: number;
}) => {
  const { currency = 'CAD', showSymbol = true, precision = 2 } = options || {};
  const roundedAmount = Math.round(amount * Math.pow(10, precision)) / Math.pow(10, precision);
  
  if (showSymbol) {
    return `${currency} $${roundedAmount.toFixed(precision)}`;
  }
  
  return roundedAmount.toFixed(precision);
};

// Usage across application:
// - PayoutRequestModal: Uses formatPayout() for CAD display
// - PayoutHistoryPage: All currency displays use formatPayout()
// - Payment services: currency set to 'cad' instead of 'usd'
// - Pricing calculations: All comments updated to specify CAD

// Database currency configuration:
// - paymentHoldService.ts: currency field set to 'cad'
// - All pricing calculations assume CAD currency
// - Minimum prices documented as CAD (e.g., "$5 CAD minimum fare")
```

### PayPal Live Payment Integration ✅ - LIVE PAYMENTS ENABLED
```typescript
// CRITICAL: PayPal integration with live payment capability and environment control

// Environment Variables (.env) - LIVE PAYMENT CONFIGURATION
VITE_PAYPAL_CLIENT_ID=AbGPQ42SxKv2Ee4epIpzj9ExeDl89H0AATL6i1cs1SNrZ6-6DFjJK6kJwykQxuNiYk1Ih5s-fFNV3Ha1
PAYPAL_CLIENT_SECRET=ENAmHMMr6_7sg7CCXrDFX343ExwXWUCfmMqQU88miymiid0OlkD_IlLFylCtLEvSBu7yZzH4wX9f0tVg
VITE_PAYPAL_SANDBOX_MODE=false // LIVE PAYMENTS ENABLED - real money processing active

// PayPal Service Integration (src/lib/paypalService.ts)
export class PayPalService {
  // Environment-based mode detection
  private static sandboxMode = import.meta.env.VITE_PAYPAL_SANDBOX_MODE !== 'false';
  
  private static get baseUrl() {
    return this.sandboxMode 
      ? 'https://api-m.sandbox.paypal.com'  // Sandbox
      : 'https://api-m.paypal.com';          // Production
  }
  
  // Enhanced methods with live payment support:
  // - createOrder(amount, currency): Creates PayPal payment order
  // - capturePlan to shorten}},