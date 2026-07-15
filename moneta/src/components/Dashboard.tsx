'use client';
import { Plus, DollarSign, TrendingUp, Flame, Shield, Wallet, Building, CreditCard, Building2, ArrowUp, ArrowDown, TrendingDown } from 'lucide-react';
import { Button } from './ui/Button';
import { formatMoney } from '../lib/formatMoney';
import type { Account, DashboardProps } from '../types';

export default function Dashboard({ personalAccounts, businessAccounts, getAccountBalance, saasMetrics, onAddTransaction, onEditOpeningBalance }: DashboardProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Hero Section */}
      <div className="gradient-hero rounded-2xl p-5 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-slide-up">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 text-shadow-soft font-display">Welcome to Moneta</h1>
            <p className="text-white/90 text-sm sm:text-lg">Your professional SaaS accounting dashboard</p>
          </div>
          <div className="hidden md:block animate-bounce-in">
            <TrendingUp className="w-20 h-20 text-white/30" />
          </div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        <div className="card-metric p-6 rounded-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
        <div>
              <p className="text-sm font-medium text-blue-600 mb-2 uppercase tracking-wide">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-blue-900 mb-1">{formatMoney(saasMetrics.mrr)}</p>
              <div className="flex items-center text-xs text-blue-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                MRR from subscriptions
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Burn Rate Card */}
        <div className={`card-metric p-6 rounded-2xl animate-slide-up ${
          saasMetrics.burnRateVsRevenue > 100 ? 'ring-2 ring-red-200' : ''
        }`} style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
                    <div>
              <p className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`}>
                Burn Rate
              </p>
              <p className={`text-3xl font-bold mb-1 ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-900' : 'text-green-900'
              }`}>
                {saasMetrics.burnRateVsRevenue.toFixed(0)}%
              </p>
              <div className={`flex items-center text-xs ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`}>
                <Flame className="w-3 h-3 mr-1" />
                Cost vs revenue ratio
                    </div>
                  </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              saasMetrics.burnRateVsRevenue > 100 ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <Flame className={`w-6 h-6 ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`} />
                </div>
          </div>
        </div>

        {/* Tax Reserve Card */}
        <div className="card-metric p-6 rounded-2xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between">
        <div>
              <p className="text-sm font-medium text-accent-600 mb-2 uppercase tracking-wide">Tax Reserve</p>
              <p className="text-3xl font-bold text-accent-900 mb-1">{formatMoney(saasMetrics.taxReserve)}</p>
              <div className="flex items-center text-xs text-accent-600">
                <Shield className="w-3 h-3 mr-1" />
                30% of total income
              </div>
            </div>
            <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-accent-600" />
            </div>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className={`card-metric p-6 rounded-2xl animate-slide-up ${
          (saasMetrics.mrr - saasMetrics.fixedCosts) < 0 ? 'ring-2 ring-red-200' : ''
        }`} style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                Net Cash Flow
              </p>
              <p className={`text-3xl font-bold mb-1 ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-900' : 'text-red-900'
              }`}>
                {formatMoney(saasMetrics.mrr - saasMetrics.fixedCosts)}
              </p>
              <div className={`flex items-center text-xs ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {((saasMetrics.mrr - saasMetrics.fixedCosts) >= 0) ? (
                  <ArrowUp className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-1" />
                )}
                Monthly net position
              </div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {((saasMetrics.mrr - saasMetrics.fixedCosts) >= 0) ? (
                <TrendingUp className={`w-6 h-6 text-emerald-600`} />
              ) : (
                <TrendingDown className={`w-6 h-6 text-red-600`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Accounts Section */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-xl font-semibold text-neutral-900 mb-6 flex items-center">
            <Wallet className="w-5 h-5 mr-3 text-blue-500" />
            Personal Accounts
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {personalAccounts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {personalAccounts.map((account: Account, index) => {
              const balance = getAccountBalance(account.id);
              return (
                <div
                  key={account.id}
                  className="card-interactive p-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 rounded-xl border border-neutral-200/50"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mr-4 shadow-md">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                      </div>
                    <div>
                        <p className="font-semibold text-neutral-900">{account.name}</p>
                        <p className="text-sm text-neutral-500 capitalize">{account.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                        {formatMoney(balance)}
                      </p>
                      <p className={`text-xs ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? 'Positive' : 'Negative'}
                      </p>
                      {onEditOpeningBalance && (
                        <button
                          type="button"
                          onClick={() => onEditOpeningBalance(account)}
                          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Opening balance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {personalAccounts.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>No personal accounts yet</p>
          </div>
            )}
        </div>
      </div>

        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="text-xl font-semibold text-neutral-900 mb-6 flex items-center">
            <Building className="w-5 h-5 mr-3 text-emerald-500" />
            Business Accounts
            <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              {businessAccounts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {businessAccounts.map((account: Account, index) => {
              const balance = getAccountBalance(account.id);
              return (
                <div
                  key={account.id}
                  className="card-interactive p-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 rounded-xl border border-neutral-200/50"
                  style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center mr-4 shadow-md">
                        <Building2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
                        <p className="font-semibold text-neutral-900">{account.name}</p>
                        <p className="text-sm text-neutral-500 capitalize">{account.type.replace('_', ' ')}</p>
          </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                        {formatMoney(balance)}
                      </p>
                      <p className={`text-xs ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? 'Positive' : 'Negative'}
                      </p>
                      {onEditOpeningBalance && (
                        <button
                          type="button"
                          onClick={() => onEditOpeningBalance(account)}
                          className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-800"
                        >
                          Opening balance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {businessAccounts.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <Building className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>No business accounts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Burn Rate Analysis */}
      <div className="card p-8 animate-slide-up" style={{ animationDelay: '0.8s' }}>
        <h2 className="text-2xl font-semibold text-neutral-900 mb-8 flex items-center">
          <Flame className="w-6 h-6 mr-3 text-accent-500" />
          Burn Rate Analysis
          <span className="ml-3 status-indicator status-warning">
            {saasMetrics.burnRateVsRevenue > 100 ? '🚨' : saasMetrics.burnRateVsRevenue > 50 ? '⚠️' : '✅'}
            {saasMetrics.burnRateVsRevenue.toFixed(0)}%
          </span>
        </h2>

        <div className="space-y-8">
          {/* Revenue vs Costs Comparison */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
                    <p className="text-sm font-medium text-neutral-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-green-700">{formatMoney(saasMetrics.mrr)}</p>
          </div>
          </div>
          </div>
              <div className="progress-bar">
                <div className="progress-fill bg-green-500" style={{ width: '100%' }}></div>
        </div>
              <p className="text-xs text-neutral-500">Your subscription revenue</p>
      </div>

        <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Fixed Costs</p>
                    <p className="text-2xl font-bold text-red-700">{formatMoney(saasMetrics.fixedCosts)}</p>
          </div>
          </div>
              </div>
              <div className="progress-bar">
            <div
                  className="progress-fill progress-fill-error"
              style={{
                width: saasMetrics.mrr > 0 ? `${Math.min((saasMetrics.fixedCosts / saasMetrics.mrr) * 100, 100)}%` : '0%'
              }}
                ></div>
              </div>
              <p className="text-xs text-neutral-500">API, hosting, and SaaS costs</p>
            </div>
          </div>

          {/* Net Cash Flow Summary */}
          <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Monthly Cash Flow</h3>
              <div className={`text-3xl font-bold ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatMoney(saasMetrics.mrr - saasMetrics.fixedCosts)}
            </div>
            </div>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              saasMetrics.burnRateVsRevenue > 100
                ? 'bg-red-100 text-red-800 border border-red-200'
                : saasMetrics.burnRateVsRevenue > 50
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}>
              {saasMetrics.burnRateVsRevenue > 100 ? '🚨 Critical' : saasMetrics.burnRateVsRevenue > 50 ? '⚠️ Warning' : '✅ Healthy'}
              <span className="font-semibold">
              {saasMetrics.burnRateVsRevenue > 100
                  ? `Burning ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                : saasMetrics.burnRateVsRevenue > 50
                  ? `Moderate burn at ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                  : `Healthy burn rate at ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                }
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Revenue Multiple</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {saasMetrics.mrr > 0 ? `${(saasMetrics.mrr / saasMetrics.fixedCosts).toFixed(1)}x` : '∞'}
            </p>
          </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Runway</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {saasMetrics.mrr > saasMetrics.fixedCosts ? '∞ months' : 'Calculate with buffer'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Break-even Point</p>
                <p className="text-lg font-semibold text-neutral-900">
                  ${Math.max(0, saasMetrics.fixedCosts - saasMetrics.mrr).toFixed(0)}/month
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Action Button */}
      <div className="flex justify-center animate-bounce-in" style={{ animationDelay: '1s' }}>
        <Button
          size="lg"
          variant="gradient"
          effect="glow"
          icon={Plus}
        onClick={onAddTransaction}
          className="shadow-2xl"
      >
          Add New Transaction
        </Button>
      </div>
    </div>
  );
}
