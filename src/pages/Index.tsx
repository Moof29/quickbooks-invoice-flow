
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Users, 
  Zap, 
  BarChart3,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthProfile } from "@/hooks/useAuthProfile";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuthProfile();

  console.log("=== Index page rendering ===", { user: !!user, loading });

  useEffect(() => {
    if (!loading && user) {
      console.log("=== Redirecting to dashboard ===");
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);
  const features = [
    {
      icon: FileText,
      title: 'Invoice Management',
      description: 'Create, manage, and track professional invoices with ease'
    },
    {
      icon: Users,
      title: 'Customer Management',
      description: 'Organize and maintain your customer relationships'
    },
    {
      icon: Zap,
      title: 'QuickBooks Integration',
      description: 'Seamlessly sync with QuickBooks Online for unified accounting'
    },
  ];

  const benefits = [
    'Professional invoice creation and customization',
    'Automatic QuickBooks Online synchronization',
    'Customer relationship management',
    'Real-time business metrics and reporting',
    'Secure cloud-based data storage',
    'Mobile-responsive design'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="bg-blue-600 rounded-lg p-2">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">Batchly</span>
            </div>
            <Button asChild>
              <Link to="/auth">
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Streamline Your
            <span className="text-blue-600 block">Invoice Management</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Create professional invoices, manage customers, and sync seamlessly with QuickBooks Online. 
            Everything you need to run your business efficiently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-3">
              <Link to="/auth">
                Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              Watch Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features designed to help you manage your business more effectively
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
                  <feature.icon className="h-10 w-10 text-blue-600" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why Choose Batchly?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Built for small to medium businesses that need professional invoicing 
                with seamless QuickBooks integration.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-blue-100 mb-6">
                Join thousands of businesses already using Batchly to streamline their operations.
              </p>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link to="/auth">
                  Start Your Free Trial <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-blue-600 rounded-lg p-2">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold">Batchly</span>
            </div>
            <p className="text-gray-400">
              © 2024 Batchly. All rights reserved. Built with modern web technologies.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
