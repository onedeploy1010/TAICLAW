import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, BellOff, TrendingUp, Shield, Gift, AlertTriangle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";

interface Notification {
  id: string;
  type: "system" | "trade" | "security" | "promotion";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const ICON_MAP = {
  system: Info,
  trade: TrendingUp,
  security: Shield,
  promotion: Gift,
};

const COLOR_MAP = {
  system: "bg-blue-500/15 text-blue-400",
  trade: "bg-primary/15 text-primary",
  security: "bg-amber-500/15 text-amber-400",
  promotion: "bg-purple-500/15 text-purple-400",
};

export default function ProfileNotificationsPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const account = useActiveAccount();

  const sampleNotifications: Notification[] = useMemo(() => [
    {
      id: "1",
      type: "system",
      title: t("notifications.welcomeTitle"),
      message: t("notifications.welcomeMsg"),
      time: t("notifications.justNow"),
      read: false,
    },
    {
      id: "2",
      type: "security",
      title: t("notifications.securityTitle"),
      message: t("notifications.securityMsg"),
      time: "1h ago",
      read: false,
    },
    {
      id: "3",
      type: "promotion",
      title: t("notifications.vipTitle"),
      message: t("notifications.vipMsg"),
      time: "2h ago",
      read: true,
    },
  ], [t]);

  const [notifications, setNotifications] = useState(sampleNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-8 lg:pt-4" data-testid="page-profile-notifications">
      <div className="gradient-green-dark p-4 pt-2 rounded-b-2xl lg:rounded-none lg:bg-transparent lg:p-0 lg:pt-2 lg:px-6" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="icon" variant="ghost" onClick={() => navigate("/profile")} data-testid="button-back-profile" className="lg:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">{t("notifications.title")}</h1>
            {unreadCount > 0 && (
              <Badge className="bg-primary/20 text-primary text-[12px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-unread-count">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={markAllRead}
              data-testid="button-mark-all-read"
            >
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
      </div>

      <div className="px-4" style={{ animation: "fadeSlideIn 0.5s ease-out 0.1s both" }}>
        {notifications.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="p-6 text-center">
              <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground" data-testid="text-no-notifications">{t("notifications.noNotifications")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const Icon = ICON_MAP[notif.type];
              return (
                <Card
                  key={notif.id}
                  className={`border-border bg-card cursor-pointer ${!notif.read ? "border-l-2 border-l-primary" : ""}`}
                  data-testid={`notification-${notif.id}`}
                  onClick={() => markRead(notif.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${COLOR_MAP[notif.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notif.title}
                          </span>
                          <span className="text-[12px] text-muted-foreground shrink-0">{notif.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                      </div>
                      {!notif.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
