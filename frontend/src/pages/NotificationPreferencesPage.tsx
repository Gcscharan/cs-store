import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  ShoppingBag,
  Gift,
  Star,
  Shield,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Monitor,
  Check,
  Plus,
} from "lucide-react";
import { useGetNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from "../store/api";
import { useToast } from "../components/AccessibleToast";
import { useLanguage } from "../contexts/LanguageContext";

interface NotificationSettings {
  [channelId: string]: {
    enabled: boolean;
    categories: {
      myOrders?: boolean;
      reminders?: {
        enabled: boolean;
        subcategories: {
          reminders_cart: boolean;
          reminders_payment: boolean;
          reminders_restock: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
}

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
  bgColor: string;
}

const NotificationPreferencesPage: React.FC = () => {
  const { t } = useLanguage();
  const [selectedChannel, setSelectedChannel] = useState<string>("whatsapp");
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["reminders"]));
  const { success: showSuccess, error: showError } = useToast();
  
  const { data: preferencesData, isLoading: isLoadingPreferences } = useGetNotificationPreferencesQuery(undefined, { skip: false });
  const [updatePreferences] = useUpdateNotificationPreferencesMutation();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    whatsapp: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: true,
          subcategories: {
            reminders_cart: true,
            reminders_payment: true,
            reminders_restock: true,
          },
        },
        silentPay: true,
        recommendations: true,
        newOffers: true,
        community: false,
        feedback: true,
        newProductAlerts: true,
      },
    },
    email: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: true,
          subcategories: {
            reminders_cart: true,
            reminders_payment: true,
            reminders_restock: true,
          },
        },
        silentPay: true,
        recommendations: true,
        newOffers: true,
        community: true,
        feedback: true,
        newProductAlerts: true,
      },
    },
    sms: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: false,
          subcategories: {
            reminders_cart: false,
            reminders_payment: false,
            reminders_restock: false,
          },
        },
        silentPay: false,
        recommendations: false,
        newOffers: false,
        community: false,
        feedback: false,
        newProductAlerts: false,
      },
    },
    push: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: true,
          subcategories: {
            reminders_cart: true,
            reminders_payment: true,
            reminders_restock: true,
          },
        },
        silentPay: true,
        recommendations: true,
        newOffers: true,
        community: false,
        feedback: true,
        newProductAlerts: true,
      },
    },
    desktop: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: true,
          subcategories: {
            reminders_cart: true,
            reminders_payment: true,
            reminders_restock: true,
          },
        },
        silentPay: true,
        recommendations: true,
        newOffers: true,
        community: false,
        feedback: true,
        newProductAlerts: true,
      },
    },
    inapp: {
      enabled: true,
      categories: {
        myOrders: true,
        reminders: {
          enabled: true,
          subcategories: {
            reminders_cart: true,
            reminders_payment: true,
            reminders_restock: true,
          },
        },
        silentPay: true,
        recommendations: true,
        newOffers: true,
        community: true,
        feedback: true,
        newProductAlerts: true,
      },
    },
  });

  const channels: NotificationChannel[] = [
    {
      id: "whatsapp",
      name: t("notifications.channels.whatsapp"),
      icon: MessageSquare,
      description: t("notifications.channels.whatsappDesc"),
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "email",
      name: t("notifications.channels.email"),
      icon: Mail,
      description: t("notifications.channels.emailDesc"),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "sms",
      name: t("notifications.channels.sms"),
      icon: Smartphone,
      description: t("notifications.channels.smsDesc"),
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      id: "push",
      name: t("notifications.channels.push"),
      icon: Bell,
      description: t("notifications.channels.pushDesc"),
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      id: "desktop",
      name: t("notifications.channels.desktop"),
      icon: Monitor,
      description: t("notifications.channels.desktopDesc"),
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      id: "inapp",
      name: t("notifications.channels.inapp"),
      icon: Bell,
      description: t("notifications.channels.inappDesc"),
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  const categories = [
    {
      id: "myOrders",
      title: t("notifications.categories.myOrders"),
      description: t("notifications.categories.myOrdersDesc"),
      icon: ShoppingBag,
    },
    {
      id: "reminders",
      title: t("notifications.categories.reminders"),
      description: t("notifications.categories.remindersDesc"),
      icon: Bell,
      expandable: true,
      subcategories: [
        { id: "reminders_cart", title: t("notifications.subcategories.cart"), description: t("notifications.subcategories.cartDesc") },
        { id: "reminders_payment", title: t("notifications.subcategories.payment"), description: t("notifications.subcategories.paymentDesc") },
        { id: "reminders_restock", title: t("notifications.subcategories.restock"), description: t("notifications.subcategories.restockDesc") },
      ],
    },
    {
      id: "silentPay",
      title: t("notifications.categories.silentPay"),
      description: t("notifications.categories.silentPayDesc"),
      icon: Shield,
    },
    {
      id: "recommendations",
      title: t("notifications.categories.recommendations"),
      description: t("notifications.categories.recommendationsDesc"),
      icon: Star,
    },
    {
      id: "newProductAlerts",
      title: t("notifications.categories.newProducts"),
      description: t("notifications.categories.newProductsDesc"),
      icon: Plus,
    },
    {
      id: "newOffers",
      title: t("notifications.categories.offers"),
      description: t("notifications.categories.offersDesc"),
      icon: Gift,
    },
    {
      id: "community",
      title: t("notifications.categories.community"),
      description: t("notifications.categories.communityDesc"),
      icon: Star,
    },
    {
      id: "feedback",
      title: t("notifications.categories.feedback"),
      description: t("notifications.categories.feedbackDesc"),
      icon: Shield,
    },
  ];

  // Load preferences from API when available
  useEffect(() => {
    if (preferencesData) {
      setSettings(preferencesData);
    }
  }, [preferencesData]);


  // Automatic save function
  const handleAutoSave = async (channelId: string, categoryKey: string, subcategoryKey?: string, enabled?: boolean) => {
    const saveKey = subcategoryKey ? `${channelId}-${categoryKey}-${subcategoryKey}` : `${channelId}-${categoryKey}`;
    
    // Add to saving state
    setSavingItems(prev => new Set([...prev, saveKey]));
  
    try {
      // Compute next settings immutably based on current state
      const prevChannel = settings[channelId] || {
        enabled: true,
        categories: {},
      };
  
      const prevCategories = (prevChannel.categories || {}) as any;
      let newCategories: any = { ...prevCategories };
  
      if (!subcategoryKey) {
        // Category-level toggle
        if (categoryKey === "reminders") {
          const prevReminders = (prevCategories.reminders || {
            enabled: false,
            subcategories: {
              reminders_cart: false,
              reminders_payment: false,
              reminders_restock: false,
            },
          }) as any;
  
          const newEnabled = enabled ?? false;
  
          // Master toggle should also toggle all sub-settings
          const newSubcategories = {
            ...(prevReminders.subcategories || {}),
            reminders_cart: newEnabled,
            reminders_payment: newEnabled,
            reminders_restock: newEnabled,
          };
  
          newCategories = {
            ...newCategories,
            reminders: {
              ...prevReminders,
              enabled: newEnabled,
              subcategories: newSubcategories,
            },
          };
        } else {
          newCategories = {
            ...newCategories,
            [categoryKey]: enabled,
          };
        }
      } else {
        // Subcategory-level toggle
        if (categoryKey === "reminders") {
          const prevReminders = (prevCategories.reminders || {
            enabled: true,
            subcategories: {},
          }) as any;
  
          const newSubcategories = {
            ...(prevReminders.subcategories || {}),
            [subcategoryKey]: enabled,
          };
  
          newCategories = {
            ...newCategories,
            reminders: {
              ...prevReminders,
              subcategories: newSubcategories,
            },
          };
        }
      }
  
      const newChannel = {
        ...prevChannel,
        categories: newCategories,
      };
  
      const nextSettings: NotificationSettings = {
        ...settings,
        [channelId]: newChannel,
      };
  
      // Update local state
      setSettings(nextSettings);
  
      // Save entire preferences to backend immediately
      await updatePreferences({ preferences: nextSettings }).unwrap();
  
      // Show success indication
      showSuccess(t("notifications.preferencesUpdated"));
    } catch (error) {
      showError(t("notifications.saveFailed"));
      console.error("Save error:", error);
    } finally {
      // Remove from saving state after a short delay
      setTimeout(() => {
        setSavingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(saveKey);
          return newSet;
        });
      }, 1000);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  const currentChannelSettings = settings[selectedChannel];

  if (isLoadingPreferences) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("notifications.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{t("notifications.title")}</h1>
                  <p className="text-gray-600">{t("notifications.subtitle")}</p>
                </div>
              </div>
              {/* Save Changes button removed for instant auto-save */}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar - Pure Navigation */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("notifications.channelsTitle")}</h2>
                <div className="space-y-2">
                  {channels.map((channel) => {
                    const Icon = channel.icon;
                    const isActive = selectedChannel === channel.id;

                    return (
                      <motion.div
                        key={channel.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          onClick={() => setSelectedChannel(channel.id)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                            isActive
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${channel.bgColor}`}>
                                <Icon className={`h-5 w-5 ${channel.color}`} />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{channel.name}</h3>
                                <p className="text-sm text-gray-500">{channel.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isActive && <ChevronRight className="h-4 w-4 text-gray-400" />}
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Notification Settings with Checkboxes */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedChannel}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200"
              >
                {/* Channel Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    {selectedChannelData && (
                      <>
                        <div className={`p-3 rounded-lg ${selectedChannelData.bgColor}`}>
                          <selectedChannelData.icon className={`h-6 w-6 ${selectedChannelData.color}`} />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900">
                            {selectedChannelData.name}
                          </h2>
                          <p className="text-gray-600">
                            {selectedChannel === 'whatsapp'
                              ? t("notifications.whatsappDesc")
                              : t("notifications.channelDesc", { channel: selectedChannelData.name.toLowerCase() })
                            }
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Category Settings */}
                <div className="p-6">
                  <div className="space-y-4">
                    {categories.map((category) => {
                      const isExpanded = expandedSections.has(category.id);
                      const Icon = category.icon;
                      
                      // Handle different category structures
                      let categoryEnabled = false;
                      if (category.id === 'reminders') {
                        categoryEnabled = (currentChannelSettings?.categories as any)?.reminders?.enabled || false;
                      } else {
                        categoryEnabled = (currentChannelSettings?.categories as any)?.[category.id] || false;
                      }

                      return (
                        <div key={category.id} className="border border-gray-200 rounded-lg">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                  <Icon className="h-5 w-5 text-gray-600" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-medium text-gray-900">{category.title}</h3>
                                  <p className="text-sm text-gray-600">{category.description}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {savingItems.has(`${selectedChannel}-${category.id}`) && (
                                  <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Check className="h-4 w-4" />
                                  </div>
                                )}
                                
                                {/* Category Checkbox */}
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={categoryEnabled}
                                    onChange={(e) => handleAutoSave(selectedChannel, category.id, undefined, e.target.checked)}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                </label>
                                
                                {/* Expand Button for Reminders */}
                                {category.expandable && (
                                  <button
                                    onClick={() => toggleSection(category.id)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expandable Subcategories for Reminders */}
                            <AnimatePresence>
                              {category.expandable && isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="mt-4 ml-12 space-y-3 border-l-2 border-gray-100 pl-4"
                                >
                                  {category.subcategories?.map((subcategory) => {
                                    const subcategoryEnabled =
                                      (currentChannelSettings?.categories as any)?.reminders?.subcategories?.[subcategory.id] || false;
                                    const saveKey = `${selectedChannel}-${category.id}-${subcategory.id}`;

                                    return (
                                      <div key={subcategory.id} className="flex items-center justify-between py-2">
                                        <div className="flex-1">
                                          <h4 className="font-medium text-gray-800">{subcategory.title}</h4>
                                          <p className="text-sm text-gray-600">{subcategory.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          {savingItems.has(saveKey) && (
                                            <div className="flex items-center gap-2 text-sm text-green-600">
                                              <Check className="h-4 w-4" />
                                            </div>
                                          )}
                                          <label className="flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={subcategoryEnabled}
                                              onChange={(e) =>
                                                handleAutoSave(selectedChannel, category.id, subcategory.id, e.target.checked)
                                              }
                                              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesPage;
